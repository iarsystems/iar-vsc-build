/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import * as Fs from "fs";
import * as Path from "path";
import * as ProjectManager from "./bindings/ProjectManager";
import { Project } from "../project";
import { Workbench } from "../../tools/workbench";
import { ThriftServiceManager } from "./thriftservicemanager";
import { PROJECTMANAGER_ID, Configuration, ProjectContext } from "./bindings/projectmanager_types";
import { ThriftClient } from "./ThriftClient";
import { Handler } from "../../../utils/handler";

export class ThriftProject implements Project {
    private fileWatcher: Vscode.FileSystemWatcher;
    private onChangedHandlers: Handler<(project: Project) => void>[] = [];

    constructor(public path:           Fs.PathLike,
                public configurations: ReadonlyArray<Configuration>,
                private serviceMgr:    ThriftServiceManager,
                private projectMgr:    ThriftClient<ProjectManager.Client>,
                private context:       ProjectContext) {
        this.fileWatcher = Vscode.workspace.createFileSystemWatcher(this.path.toString());

        this.fileWatcher.onDidChange(() => {
            this.reload();
            this.onChangedHandlers.forEach(handler => handler.call(this));
        });
    }

    get name(): string {
        return Path.parse(this.path.toString()).name;
    }

    // TODO: fix interface signature
    public async reload() {
        this.projectMgr.service.CloseProject(this.context);
        this.context = await this.projectMgr.service.LoadEwpFile(this.path.toString());
        this.configurations = await this.projectMgr.service.GetConfigurations(this.context);
    }

    public async unload() {
        this.projectMgr.service.CloseProject(this.context);
        this.projectMgr.close();
        await this.serviceMgr.stop();
    }

    public onChanged(callback: (project: Project) => void, thisArg?: any): void {
        this.onChangedHandlers.push(new Handler(callback, thisArg));
    }
}

export namespace ThriftProject {
    // since constructors can't be async, we load the project async statically
    export async function load(path: Fs.PathLike, workbench: Workbench): Promise<ThriftProject> {
        const serviceManager = new ThriftServiceManager(workbench);
        const projectManager = await serviceManager.findService(PROJECTMANAGER_ID, ProjectManager);
        const projectContext = await projectManager.service.LoadEwpFile(path.toString());
        const configs        = await projectManager.service.GetConfigurations(projectContext);

        return new ThriftProject(path, configs, serviceManager, projectManager, projectContext);
    }
}