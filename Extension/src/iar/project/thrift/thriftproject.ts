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
import { QtoPromise } from "../../../utils/promise";

export class ThriftProject implements ExtendedProject {
    private fileWatcher: Vscode.FileSystemWatcher;
    private onChangedHandlers: Handler<(project: LoadedProject) => void>[] = [];

    constructor(public path:           Fs.PathLike,
                public configurations: ReadonlyArray<Configuration>,
                private projectMgr:    ProjectManager.Client,
                private context:       ProjectContext) {
        // TODO: this should probably be changed to some thrift-based listener
        this.fileWatcher = Vscode.workspace.createFileSystemWatcher(this.path.toString());
        this.fileWatcher.onDidChange(() => {
            this.reload();
            this.onChangedHandlers.forEach(handler => handler.call(this));
        });
    }

    get name(): string {
        return Path.parse(this.path.toString()).name;
    }

    public async removeConfiguration(config: Config) {
        await this.projectMgr.RemoveConfiguration(config.name, this.context);
        this.configurations = await this.projectMgr.GetConfigurations(this.context);
        this.onChangedHandlers.forEach(handler => handler.call(this)); // TODO: maybe break out this line
        return Promise.resolve();
    }

    public addConfiguration(config: Config, isDebug: boolean): Promise<void> {
        return QtoPromise(this.projectMgr.AddConfiguration(config, this.context, isDebug));
    }
    public getRootNode(): Promise<Node> {
        return QtoPromise(this.projectMgr.GetRootNode(this.context));
    }
    public setNode(node: Node): Promise<void> {
        return QtoPromise(this.projectMgr.SetNode(this.context, node));
    }

    // TODO: fix interface signature
    public async reload() {
        this.projectMgr.CloseProject(this.context);
        this.context = await this.projectMgr.LoadEwpFile(this.path.toString());
        this.configurations = await this.projectMgr.GetConfigurations(this.context);
    }

    public async unload() {
        this.projectMgr.CloseProject(this.context);
    }

    public onChanged(callback: (project: LoadedProject) => void, thisArg?: any): void {
        this.onChangedHandlers.push(new Handler(callback, thisArg));
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