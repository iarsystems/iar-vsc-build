/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as ProjectManager from "iar-vsc-common/thrift/bindings/ProjectManager";
import * as LogService from "iar-vsc-common/thrift/bindings/LogService";
import * as Fs from "fs";
import * as Path from "path";
import { Workbench } from "iar-vsc-common/workbench";
import { PROJECTMANAGER_ID } from "iar-vsc-common/thrift/bindings/projectmanager_types";
import { ThriftServiceManager } from "iar-vsc-common/thrift/thriftServiceManager";
import { ProjectManagerLauncher } from "./project/thrift/projectmanagerlauncher";
import { ThriftClient } from "iar-vsc-common/thrift/thriftClient";
import { logger } from "iar-vsc-common/logger";
import { IarOsUtils } from "iar-vsc-common/osUtils";
import { EwwFile } from "./workspace/ewwfile";
import { ThriftWorkspace } from "./workspace/thriftworkspace";
import { ExtendedEwWorkspace } from "./workspace/ewworkspace";
import { LOGSERVICE_ID } from "iar-vsc-common/thrift/bindings/logservice_types";

/**
 * A workbench with some extra capabilities,
 * such as querying for toolchains (platforms) and loading {@link ExtendedProject}s.
 */
export interface ExtendedWorkbench {
    readonly workbench: Workbench;

    /**
     * Loads the given workspace.
     *
     * Calling this invalidates any existing workspace loaded from here.
     */
    loadWorkspace(workspace: EwwFile): Promise<ExtendedEwWorkspace>;

    /**
     * Loads a set of projects as a workspace without a .eww file.
     */
    loadAnonymousWorkspace(projects: string[]): Promise<ExtendedEwWorkspace>;

    /**
     * Closes the current workspace, invalidating any existing workspace from
     * {@link loadWorkspace}.
     */
    closeWorkspace(): Promise<void>;

    dispose(): Promise<void>;

    /**
     * Adds a callback to be called when the workbench backend crashes unexpectedly
     * (i.e. when it exits without {@link dispose} having been called).
     */
    onCrash(handler: (code: number | null) => void): void;

    /**
     * Register a receiver of IDE platform logs. Only one log handler can be set.
     * @param handler The object to receive logs. Must implement the 'logservice' thrift service.
     */
    setLogHandler(handler: object): Promise<void>;
}

/**
 * A workbench thrift and a project manager service to provide extended capabilities,
 * such as querying for toolchains (platforms) and loading {@link ExtendedProject}s.
 */
export class ThriftWorkbench implements ExtendedWorkbench {
    /**
     * Creates and returns a new {@link ThriftWorkbench} from the given workbench.
     */
    static async from(workbench: Workbench): Promise<ThriftWorkbench> {
        logger.debug(`Loading thrift workbench '${workbench.name}'`);
        const serviceManager = await ProjectManagerLauncher.launchFromWorkbench(workbench);
        const projectManager = await serviceManager.findService(PROJECTMANAGER_ID, ProjectManager);
        return new ThriftWorkbench(workbench, serviceManager, projectManager);
    }

    static hasThriftSupport(workbench: Workbench): boolean {
        return Fs.existsSync(Path.join(workbench.path.toString(), "common/bin/projectmanager.json"))
            && Fs.existsSync(Path.join(workbench.path.toString(), "common/bin/IarServiceLauncher" + IarOsUtils.executableExtension()));
    }

    private loadedWorkspace: Promise<ThriftWorkspace | undefined> | undefined = undefined;
    private hasLogHandler = false;

    constructor(public workbench: Workbench,
        private readonly serviceMgr: ThriftServiceManager,
        private readonly projectMgr: ThriftClient<ProjectManager.Client>) {
    }

    public loadWorkspace(file: EwwFile): Promise<ExtendedEwWorkspace> {
        const workspacePromise = this.closeWorkspace().then(() => {
            logger.debug(`Loading thrift workspace: ${file.name}`);

            return ThriftWorkspace.fromEwwFile(
                file, this.projectMgr.service, this.workbench);
        });
        this.loadedWorkspace = workspacePromise.catch(() => undefined);
        return workspacePromise;
    }

    public loadAnonymousWorkspace(projects: string[]): Promise<ExtendedEwWorkspace> {
        const workspacePromise = this.closeWorkspace().then(() => {
            logger.debug(`Loading anonymous thrift workspace with ${projects.length} projects.`);

            return ThriftWorkspace.fromProjectPaths(
                projects, this.projectMgr.service, this.workbench);
        });
        this.loadedWorkspace = workspacePromise;
        return workspacePromise;
    }

    public async closeWorkspace(): Promise<void> {
        const loadedWorkspacePromise = this.loadedWorkspace;
        this.loadedWorkspace = undefined;
        const loadedWorkspace = await loadedWorkspacePromise;
        try {
            await loadedWorkspace?.dispose();
        } catch (e) {
            logger.warn(`Failed to dispose of workspace '${loadedWorkspace?.name}': ${e}`);
        }
    }

    public async dispose() {
        logger.debug(`Shutting down thrift workbench '${this.workbench.name}'`);
        await this.closeWorkspace();
        this.projectMgr.close();
        await this.serviceMgr.dispose();
    }

    public onCrash(handler: (code: number | null) => void) {
        this.serviceMgr.addCrashHandler(handler);
    }

    public async setLogHandler(handler: object): Promise<void> {
        if (this.hasLogHandler) {
            throw new Error("A log handler has already been set for this workbench.");
        }
        await this.serviceMgr.startService(LOGSERVICE_ID, LogService, handler);
        this.hasLogHandler = true;
    }
}
