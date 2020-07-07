/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import * as Fs from "fs";
import * as Path from "path";
import * as ProjectManager from "./bindings/ProjectManager";
import { LoadedProject, ExtendedProject } from "../project";
import { Configuration, ProjectContext, Node } from "./bindings/projectmanager_types";
import { Handler } from "../../../utils/handler";
import { Config } from "../config";

/**
 * A project using a thrift-capable backend to fetch and manage data.
 */
export class ThriftProject implements ExtendedProject {
    private fileWatcher: Vscode.FileSystemWatcher;
    // TODO: should maybe provide separate handlers for changes to specific data
    private onChangedHandlers: Handler<(project: LoadedProject) => void>[] = [];

    constructor(public path:           Fs.PathLike,
                public configurations: ReadonlyArray<Configuration>,
                private projectMgr:    ProjectManager.Client,
                private context:       ProjectContext) {
        // TODO: this should probably be changed to some thrift-based listener
        this.fileWatcher = Vscode.workspace.createFileSystemWatcher(this.path.toString());
        this.fileWatcher.onDidChange(() => {
            // this.reload();
            // this.fireChangedEvent();
        });
    }

    get name(): string {
        return Path.parse(this.path.toString()).name;
    }

    public async removeConfiguration(config: Config): Promise<void> {
        await this.projectMgr.RemoveConfiguration(config.name, this.context);
        this.configurations = await this.projectMgr.GetConfigurations(this.context);
        this.fireChangedEvent();
    }

    public async addConfiguration(config: Config, isDebug: boolean): Promise<void> {
        await this.projectMgr.AddConfiguration(config, this.context, isDebug)
        this.configurations = await this.projectMgr.GetConfigurations(this.context);
        this.fireChangedEvent();
    }
    public async getRootNode(): Promise<Node> {
        return this.projectMgr.GetRootNode(this.context);
    }
    public async setNode(node: Node): Promise<void> {
        await this.projectMgr.SetNode(this.context, node);
        this.fireChangedEvent();
    }

    public async reload() {
        this.projectMgr.CloseProject(this.context);
        this.context = await this.projectMgr.LoadEwpFile(this.path.toString());
        this.configurations = await this.projectMgr.GetConfigurations(this.context);
        this.fireChangedEvent();
    }

    public async unload() {
        this.projectMgr.CloseProject(this.context);
        this.fileWatcher.dispose();
    }

    public onChanged(callback: (project: LoadedProject) => void, thisArg?: any): void {
        this.onChangedHandlers.push(new Handler(callback, thisArg));
    }

    private fireChangedEvent() {
        this.onChangedHandlers.forEach(handler => handler.call(this));
    }
}

export namespace ThriftProject {
    // since constructors can't be async, we load the project async statically
    export async function load(path: Fs.PathLike, pm: ProjectManager.Client): Promise<ThriftProject> {
        const projectContext = await pm.LoadEwpFile(path.toString());
        const configs        = await pm.GetConfigurations(projectContext);

        return new ThriftProject(path, configs, pm, projectContext);
    }
}