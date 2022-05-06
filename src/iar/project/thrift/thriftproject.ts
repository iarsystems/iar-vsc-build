/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Path from "path";
import * as ProjectManager from "iar-vsc-common/thrift/bindings/ProjectManager";
import { ExtendedProject } from "../project";
import { Configuration, ProjectContext, Node, NodeType } from "iar-vsc-common/thrift/bindings/projectmanager_types";
import { QtoPromise } from "../../../utils/promise";
import { Workbench } from "iar-vsc-common/workbench";
import Int64 = require("node-int64");
import { InformationDialog, InformationDialogType } from "../../../extension/ui/informationdialog";
import { WorkbenchVersions } from "../../tools/workbenchversionregistry";
import { logger } from "iar-vsc-common/logger";
import { Config } from "../config";

/**
 * A project using a thrift-capable backend to fetch and manage data.
 */
export class ThriftProject implements ExtendedProject {
    // TODO: should maybe provide separate handlers for changes to specific data
    private readonly onChangedHandlers: (() => void)[] = [];

    constructor(public path:                 string,
                public configurations:       ReadonlyArray<Configuration>,
                private readonly projectMgr: ProjectManager.Client,
                private readonly context:             ProjectContext,
                private readonly owner:      Workbench) {
    }

    get name(): string {
        return Path.parse(this.path.toString()).name;
    }

    public getRootNode(): Promise<Node> {
        return Promise.resolve(this.projectMgr.GetRootNode(this.context));
    }
    public async setNode(node: Node, indexPath: number[]): Promise<void> {
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

    public unload() {
        logger.debug(`Unloading project '${this.name}'`);
        // note that we do not unload the project context from the project manager.
        // it is owned by the ThriftWorkbench and will be unloaded when the workbench is disposed
    }

    public onChanged(callback: () => void): void {
        this.onChangedHandlers.push(callback);
    }
    public findConfiguration(name: string): Config | undefined {
        return this.configurations.find(config => config.name === name);
    }

    private fireChangedEvent() {
        this.onChangedHandlers.forEach(handler => handler());
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
    export async function fromContext(path: string, pm: ProjectManager.Client, context: ProjectContext, owner: Workbench): Promise<ThriftProject> {
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