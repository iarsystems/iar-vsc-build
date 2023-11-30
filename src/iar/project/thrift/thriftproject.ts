/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as vscode from "vscode";
import * as Path from "path";
import * as ProjectManager from "iar-vsc-common/thrift/bindings/ProjectManager";
import { ExtendedProject } from "../project";
import { ProjectContext, Node, NodeType } from "iar-vsc-common/thrift/bindings/projectmanager_types";
import { QtoPromise } from "../../../utils/promise";
import { Workbench } from "iar-vsc-common/workbench";
import Int64 = require("node-int64");
import { InformationMessage, InformationMessageType } from "../../../extension/ui/informationmessage";
import { WorkbenchFeatures } from "iar-vsc-common/workbenchfeatureregistry";
import { Config } from "../config";
import { IarVsc } from "../../../extension/main";
import { Disposable } from "../../../utils/disposable";
import { BackupUtils, ErrorUtils } from "../../../utils/utils";
import { logger } from "iar-vsc-common/logger";
import { Mutex } from "async-mutex";

/**
 * A project using a thrift-capable backend to fetch and manage data.
 */
export class ThriftProject implements ExtendedProject, Disposable {
    private onChangedHandlers: (() => void)[] = [];
    private readonly controlFileWatchers: Map<string, vscode.Disposable> = new Map;
    private readonly currentOperations: Promise<unknown>[] = [];
    // Locked during actions that require a certain active configuration in the backend.
    private readonly activeConfigurationMtx = new Mutex;

    constructor(public path:                 string,
                public configurations:       ReadonlyArray<Config>,
                private activeConfiguration: Config | undefined,
                private readonly projectMgr: ProjectManager.Client,
                private context:             ProjectContext,
                private readonly owner:      Workbench,
    ) {
        this.updateControlFileWatchers();
    }

    get name(): string {
        return Path.parse(this.path.toString()).name;
    }

    public async reload(): Promise<void> {
        await this.performOperation(async() => {
            if (WorkbenchFeatures.supportsFeature(this.owner, WorkbenchFeatures.PMReloadProject)) {
                await BackupUtils.doWithBackupCheck(this.path, async() => {
                    this.context = await this.projectMgr.ReloadProject(this.context);
                });
            } else {
                if (WorkbenchFeatures.supportsFeature(this.owner, WorkbenchFeatures.PMWorkspaces)) {
                    await this.projectMgr.RemoveProject(this.context);
                } else {
                    await this.projectMgr.CloseProject(this.context);
                }

                this.context = await BackupUtils.doWithBackupCheck(this.path, async() => {
                    return await this.projectMgr.LoadEwpFile(this.path);
                });
            }

            this.configurations = (await this.projectMgr.GetConfigurations(this.context)).map(thriftConfig => {
                return {
                    name: thriftConfig.name,
                    targetId: Config.toolchainIdToTargetId(thriftConfig.toolchainId),
                };
            });
            await this.updateControlFileWatchers();
        });
        this.fireChangedEvent();
    }

    public getRootNode(config?: Config): Promise<Node> {
        return this.performOperation(() => {
            const promise = async() =>{
                const root = await this.projectMgr.GetRootNode(this.context);
                // VSC-300 Generated nodes cannot be trusted to be up-to-date, and should not be used at all.
                // Thus, we hide them here, as close to the source as possible.
                const recurseRemoveGeneratedNodes = (node: Node) => {
                    node.children = node.children.filter(child => !child.isGenerated);
                    node.children.forEach(child => recurseRemoveGeneratedNodes(child));
                };
                recurseRemoveGeneratedNodes(root);
                return root;
            };
            if (config) {
                return this.withActiveConfiguration(config, promise);
            } else {
                return promise();
            }
        });
    }
    public setNode(node: Node, indexPath: number[]): Promise<void> {
        return this.performOperation(async() => {
            IarVsc.ewpWatcher?.supressNextFileModificationFor(this.path);
            if (WorkbenchFeatures.supportsFeature(this.owner, WorkbenchFeatures.SetNodeByIndex)) {
                await this.projectMgr.SetNodeByIndex(this.context, indexPath.map(i => new Int64(i)), node, true);
            } else {
                if (!WorkbenchFeatures.supportsFeature(this.owner, WorkbenchFeatures.SetNodeCanRemoveNodes)) {
                    // Mitigate a backend bug causing duplicated groups by trying to only send *new* children.
                    const existingNode =
                        findNodeByIndexPath(await this.getRootNode(), indexPath);
                    filterNewNodes(node, existingNode);
                }
                // eslint-disable-next-line deprecation/deprecation
                await this.projectMgr.SetNode(this.context, node);
            }
            this.fireChangedEvent();
        });
    }

    getCStatOutputDirectory(config: string): Promise<string | undefined> {
        return this.performOperation(async() => {
            const fullConfig = this.findConfiguration(config);
            if (fullConfig === undefined) {
                return Promise.reject(new Error(`Project '${this.name}' has no configuration '${config}'.`));
            }
            if (!WorkbenchFeatures.supportsFeature(this.owner, WorkbenchFeatures.FetchProjectOptions, fullConfig.targetId)) {
                return undefined;
            }

            const options = await this.projectMgr.GetOptionsForConfiguration(this.context, config);
            const outDir = options.find(option => option.id === "C-STAT.OutputDir")?.value;
            if (outDir !== undefined) {
                return outDir;
            }
            return Promise.reject(new Error("Could not find the correct C-STAT option."));
        });
    }

    getCSpyArguments(config: string): Promise<string[] | undefined> {
        return this.performOperation(() => {
            const fullConfig = this.findConfiguration(config);
            if (fullConfig === undefined) {
                throw new Error(`Project '${this.name}' has no configuration '${config}'.`);
            }
            if (!WorkbenchFeatures.supportsFeature(this.owner, WorkbenchFeatures.FetchToolArguments, fullConfig.targetId)) {
                return Promise.resolve(undefined);
            }
            return QtoPromise(this.projectMgr.GetToolArgumentsForConfiguration(this.context, "C-SPY", config));
        });
    }

    public addOnChangeListener(callback: () => void): void {
        this.onChangedHandlers.push(callback);
    }
    public removeOnChangeListener(callback: () => void): void {
        const idx = this.onChangedHandlers.indexOf(callback);
        if (idx !== -1) {
            this.onChangedHandlers.splice(idx, 1);
        }
    }

    public findConfiguration(name: string): Config | undefined {
        return this.configurations.find(config => config.name === name);
    }

    public async dispose(): Promise<void> {
        this.onChangedHandlers = [];
        await Promise.allSettled(this.currentOperations);
        await this.projectMgr.CloseProject(this.context);

        for (const watcher of this.controlFileWatchers.values()) {
            watcher.dispose();
        }
        this.controlFileWatchers.clear();
    }

    private async updateControlFileWatchers() {
        const controlFiles = new Set<string>;
        const collectControlFiles = function(node: Node): void {
            if (node.controlFilePlugins.length > 0) {
                controlFiles.add(node.path);
            }
            node.children.forEach(collectControlFiles);
        };
        const root = await this.getRootNode();
        collectControlFiles(root);

        const toAdd = Array.from(controlFiles).filter(file => !this.controlFileWatchers.has(file));

        const toRemove = Array.from(this.controlFileWatchers.keys()).filter(file => !controlFiles.has(file));
        if (toRemove.length > 0) {
            logger.debug(`${this.name}: Removing watchers for ${toRemove.length} control file(s).`);
            toRemove.forEach(file => {
                this.controlFileWatchers.get(file)?.dispose();
                this.controlFileWatchers.delete(file);
            });
        }

        if (toAdd.length > 0) {
            logger.debug(`${this.name}: Adding watchers for ${toAdd.length} control file(s).`);
            toAdd.forEach(file => {
                const watcher = vscode.workspace.createFileSystemWatcher(file, true, false, true);
                this.controlFileWatchers.set(file, watcher);
                watcher.onDidChange(() => {
                    this.performOperation(async() => {
                        try {
                            await this.projectMgr.UpdateProjectConnection(this.context, file);
                            this.configurations = (await this.projectMgr.GetConfigurations(this.context)).map(thriftConfig => {
                                return {
                                    name: thriftConfig.name,
                                    targetId: Config.toolchainIdToTargetId(thriftConfig.toolchainId),
                                };
                            });
                            await this.updateControlFileWatchers();
                            this.fireChangedEvent();
                        } catch (e) {
                            logger.error("Failed to update project connection: " + ErrorUtils.toErrorMessage(e));
                        }
                    });
                });
            });
        }
    }

    private fireChangedEvent() {
        this.onChangedHandlers.forEach(handler => handler());
    }

    // Runs an action with the given configuration set as active in the backend.
    // This requires exclusivity, so that the active configuration isn't changed
    // by some other operation while this one is running.
    private withActiveConfiguration<T>(config: Config, operation: () => Promise<T>): Promise<T> {
        return this.activeConfigurationMtx.runExclusive(async() => {
            if (this.activeConfiguration !== config) {
                await this.projectMgr.SetCurrentConfiguration(this.context, config.name);
                this.activeConfiguration = config;
            }
            return operation();
        });
    }

    // Registers an operation (i.e. a thrift procedure call) that uses the project context. The operation will be
    // awaited before invalidating the project context (as long as the owner of this instance calls {@link
    // dispose}).
    // ! All thrift procedure calls should go through this method.
    private performOperation<T>(operation: () => Promise<T>): Promise<T> {
        const promise = operation();
        this.currentOperations.push(promise);
        promise.finally(() => this.currentOperations.splice(this.currentOperations.indexOf(promise), 1));
        return promise;
    }
}

export namespace ThriftProject {

    /**
     * Loads a thrift project into the given project manager
     * @param file The .ewp file to load
     * @param pm The thrift project manager where the project should be loaded
     * @param owner The workbench that owns the project manager. Used to know e.g. what APIs versions are available.
     * @returns
     */
    export async function load(file: string, pm: ProjectManager.Client, owner: Workbench): Promise<ThriftProject> {
        const ctx = await BackupUtils.doWithBackupCheck(file, async() => {
            return await pm.LoadEwpFile(file);
        });
        return fromContext(ctx, pm, owner);
    }

    /**
     * Creates a thrift project from a loaded project context.
     * @param context The project context
     * @param pm The thrift project manager where the context is loaded
     * @param owner The workbench that owns the project manager. Used to know e.g. what APIs versions are available.
     * @returns
     */
    export async function fromContext(context: ProjectContext, pm: ProjectManager.Client, owner: Workbench): Promise<ThriftProject> {
        // VSC-233 Warn users about having several groups with the same name
        if (!WorkbenchFeatures.supportsFeature(owner, WorkbenchFeatures.SetNodeByIndex)) {
            const node = await pm.GetRootNode(context);
            if (hasDuplicateGroupNames(new Set(), node)) {
                const prompt = `The project ${Path.basename(context.filename)} has several groups with the same name. This may cause unwanted behaviour when adding or removing files.`;
                InformationMessage.show("duplicateGroups", prompt, InformationMessageType.Warning);
            }
        }

        const configs = (await pm.GetConfigurations(context)).map(thriftConfig => {
            return {
                name: thriftConfig.name,
                targetId: Config.toolchainIdToTargetId(thriftConfig.toolchainId),
            };
        });
        const activeConfigName = (await pm.GetCurrentConfiguration(context)).name;
        const activeConfig = configs.find(conf => conf.name === activeConfigName);


        return new ThriftProject(context.filename, configs, activeConfig, pm, context, owner);
    }
}

function hasDuplicateGroupNames(discoveredGroupNames: Set<string>, node: Node): boolean {
    if (node.type === NodeType.Group) {
        if (discoveredGroupNames.has(node.name)) {
            return true;
        }
        discoveredGroupNames.add(node.name);
    }
    return node.children.some(child => hasDuplicateGroupNames(discoveredGroupNames, child));
}

function findNodeByIndexPath(root: Node, path: number[]) {
    let node: Node | undefined = root;
    path.forEach(index => {
        node = node?.children[index];
    });
    return node;
}

/**
 * Modifies 'updated' in-place to include the smallest possible set of dependent necessary
 * to represent the new nodes (i.e. those note present in 'original').
 */
function filterNewNodes(updated: Node, original: Node) {
    console.log(updated, original);
    updated.children = updated.children.filter(child => {
        const origChild = original.children.find(candidate => candidate.name === child.name);
        return origChild === undefined || filterNewNodes(child, origChild);
    });
    return updated.children.length > 0;
}