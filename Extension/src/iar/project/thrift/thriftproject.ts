/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import * as Fs from "fs";
import * as Path from "path";
import * as ProjectManager from "./bindings/ProjectManager";
import { LoadedProject, ExtendedProject } from "../project";
import { Configuration, ProjectContext, Node } from "./bindings/projectmanager_types";

/**
 * A project using a thrift-capable backend to fetch and manage data.
 */
export class ThriftProject implements ExtendedProject {
    private readonly fileWatcher: Vscode.FileSystemWatcher;
    // TODO: should maybe provide separate handlers for changes to specific data
    private readonly onChangedHandlers: ((project: LoadedProject) => void)[] = [];
    private ignoreNextFileChange = false;

    constructor(public path:           Fs.PathLike,
                public configurations: ReadonlyArray<Configuration>,
                private readonly projectMgr:    ProjectManager.Client,
                private context:       ProjectContext) {
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
    public async setNode(node: Node): Promise<void> {
        this.ignoreNextFileChange = true;
        await this.projectMgr.SetNode(this.context, node);
        this.fireChangedEvent();
    }

    public async reload() {
        await this.projectMgr.CloseProject(this.context);
        this.context = await this.projectMgr.LoadEwpFile(this.path.toString());
        this.configurations = await this.projectMgr.GetConfigurations(this.context);
        this.fireChangedEvent();
    }

    public unload() {
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
    // since constructors can't be async, we load the project async statically
    export async function fromContext(path: Fs.PathLike, pm: ProjectManager.Client, context: ProjectContext): Promise<ThriftProject> {
        const configs        = await pm.GetConfigurations(context);
        return new ThriftProject(path, configs, pm, context);
    }
}