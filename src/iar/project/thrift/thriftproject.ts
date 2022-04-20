/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import * as Fs from "fs";
import * as Path from "path";
import * as ProjectManager from "iar-vsc-common/thrift/bindings/ProjectManager";
import { LoadedProject, ExtendedProject } from "../project";
import { Configuration, ProjectContext, Node, NodeType } from "iar-vsc-common/thrift/bindings/projectmanager_types";
import { QtoPromise } from "../../../utils/promise";
import { Workbench } from "iar-vsc-common/workbench";
import Int64 = require("node-int64");
import { InformationDialog, InformationDialogType } from "../../../extension/ui/informationdialog";
import { WorkbenchVersions } from "../../tools/workbenchversionregistry";
import { logger } from "iar-vsc-common/logger";

/**
 * A project using a thrift-capable backend to fetch and manage data.
 */
export class ThriftProject implements ExtendedProject {
    private readonly fileWatcher: Vscode.FileSystemWatcher;
    // TODO: should maybe provide separate handlers for changes to specific data
    private readonly onChangedHandlers: ((project: LoadedProject) => void)[] = [];
    private ignoreNextFileChange = false;

    constructor(public path:                 Fs.PathLike,
                public configurations:       ReadonlyArray<Configuration>,
                private readonly projectMgr: ProjectManager.Client,
                private context:             ProjectContext,
                private readonly owner:      Workbench) {
        // TODO: this should probably be changed to some thrift-based listener
        this.fileWatcher = Vscode.workspace.createFileSystemWatcher(this.path.toString());
        this.fileWatcher.onDidChange(() => {
            if (this.ignoreNextFileChange) {
                this.ignoreNextFileChange = false;
                return;
            }
            this.reload();
        });
    }

    get name(): string {
        return Path.parse(this.path.toString()).name;
    }

    public getRootNode(): Promise<Node> {
        return Promise.resolve(this.projectMgr.GetRootNode(this.context));
    }
    public async setNode(node: Node, indexPath: number[]): Promise<void> {
        this.ignoreNextFileChange = true;
        if (WorkbenchVersions.doCheck(this.owner, WorkbenchVersions.supportsSetNodeByIndex)) {
            await this.projectMgr.SetNodeByIndex(this.context, indexPath.map(i => new Int64(i)), node, true);
        } else {
            // eslint-disable-next-line deprecation/deprecation
            await this.projectMgr.SetNode(this.context, node);
        }
        this.fireChangedEvent();
    }

    async getCStatOutputDirectory(config: string): Promise<string | undefined> {
        if (!this.configurations.some(c => c.name === config)) {
            return Promise.reject(new Error(`Project '${this.name}' has no configuration '${config}'.`));
        }
        if (!WorkbenchVersions.doCheck(this.owner, WorkbenchVersions.canFetchProjectOptions)) {
            return undefined;
        }
        const options = await this.projectMgr.GetOptionsForConfiguration(this.context, config);
        const outDir = options.find(option => option.id === "C-STAT.OutputDir")?.value;
        if (outDir !== undefined) {
            return outDir;
        }
        return Promise.reject(new Error("Could not find the correct C-STAT option."));
    }

    getCSpyArguments(config: string): Promise<string[] | undefined> {
        if (!this.configurations.some(c => c.name === config)) {
            throw new Error(`Project '${this.name}' has no configuration '${config}'.`);
        }
        if (!WorkbenchVersions.doCheck(this.owner, WorkbenchVersions.canFetchProjectOptions)) {
            return Promise.resolve(undefined);
        }
        return QtoPromise(this.projectMgr.GetToolArgumentsForConfiguration(this.context, "C-SPY", config));
    }

    public async reload() {
        logger.debug(`Reloading project '${this.name}'`);
        this.configurations = await this.projectMgr.GetConfigurations(this.context);
        this.fireChangedEvent();
    }

    public unload() {
        logger.debug(`Unloading project '${this.name}'`);
        this.fileWatcher.dispose();
        // note that we do not unload the project context from the project manager.
        // it is owned by the ThriftWorkbench and will be unloaded when the workbench is disposed
    }

    public onChanged(callback: (project: LoadedProject) => void): void {
        this.onChangedHandlers.push(callback);
    }

    private fireChangedEvent() {
        this.onChangedHandlers.forEach(handler => handler(this));
    }
}

export namespace ThriftProject {
    /**
     * Creates a thrift project from a loaded project context.
     * @param path The path to the .ewp file
     * @param pm The thrift project manager where the context is loaded
     * @param context The project context
     * @param owner The workbench that has loaded the project. Used to know e.g. what APIs versions are available.
     * @returns
     */
    export async function fromContext(path: Fs.PathLike, pm: ProjectManager.Client, context: ProjectContext, owner: Workbench): Promise<ThriftProject> {
        const configs = await pm.GetConfigurations(context);

        // VSC-233 Warn users about having several groups with the same name
        if (!WorkbenchVersions.doCheck(owner, WorkbenchVersions.supportsSetNodeByIndex)) {
            const node = await pm.GetRootNode(context);
            if (hasDuplicateGroupNames(new Set(), node)) {
                const prompt = `The project ${Path.basename(path.toString())} has several groups with the same name. This may cause unwanted behaviour when adding or removing files.`;
                InformationDialog.show("duplicateGroups", prompt, InformationDialogType.Warning);
            }
        }
        return new ThriftProject(path, configs, pm, context, owner);
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