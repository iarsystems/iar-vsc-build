/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as ProjectManager from "iar-vsc-common/thrift/bindings/ProjectManager";
import * as Fs from "fs";
import * as Vscode from "vscode";
import * as Path from "path";
import { Workbench } from "iar-vsc-common/workbench";
import { PROJECTMANAGER_ID, ProjectContext } from "iar-vsc-common/thrift/bindings/projectmanager_types";
import { ExtendedProject, Project } from "./project/project";
import { ThriftServiceManager } from "iar-vsc-common/thrift/thriftServiceManager";
import { ProjectManagerLauncher } from "./project/thrift/projectmanagerlauncher";
import { ThriftClient } from "iar-vsc-common/thrift/thriftClient";
import { ThriftProject } from "./project/thrift/thriftproject";
import { BackupUtils } from "../utils/utils";
import { logger } from "iar-vsc-common/logger";
import { IarOsUtils, OsUtils } from "iar-vsc-common/osUtils";
import { Mutex } from "async-mutex";
import { WorkbenchFeatures } from "./tools/workbenchfeatureregistry";
import { EwWorkspace, ExtendedEwWorkspace } from "./workspace/ewworkspace";
import { ThriftWorkspace } from "./workspace/thriftworkspace";

/**
 * A workbench with some extra capabilities,
 * such as querying for toolchains (platforms) and loading {@link ExtendedProject}s.
 */
export interface ExtendedWorkbench {
    readonly workbench: Workbench;

    /**
     * Loads the given project into a {@link ExtendedProject}. Loaded projects are kept in memory (i.e. in a workspace).
     * To evict a project from memory and force it to be reloaded from disk, call {@link unloadProject}.
     */
    loadProject(project: Project): Promise<ExtendedProject>;
    /**
     * Unloads the given project if it has previously been loaded.
     * The next time the project is loaded using this workbench, a full load from
     * disk will be performed.
     * Note that this invalidates all currently loaded instances of the project.
     */
    unloadProject(project: Project): Promise<void>;

    /**
     * Loads the given workspace.
     *
     * This affects e.g. how some argvars are expanded. Calling this unloads
     * *all* currently loaded projects, invalidating all existing
     * {@link ExtendedProject} instances from this workbench.
     */
    loadWorkspace(workspace: EwWorkspace): Promise<ExtendedEwWorkspace>;

    /**
     * Closes the current workspace.
     *
     * This affects e.g. how some argvars are expanded. Calling this unloads
     * *all* currently loaded projects, invalidating all existing
     * {@link ExtendedProject} instances from this workbench.
     */
    closeWorkspace(): Promise<void>;



    dispose(): Promise<void>;

    /**
     * Adds a callback to be called when the workbench backend crashes unexpectedly
     * (i.e. when it exits without {@link dispose} having been called).
     */
    onCrash(handler: (code: number | null) => void): void;
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
        const serviceManager = await ProjectManagerLauncher.launchFromWorkbench(workbench);
        const projectManager = await serviceManager.findService(PROJECTMANAGER_ID, ProjectManager);
        return new ThriftWorkbench(workbench, serviceManager, projectManager);
    }

    static hasThriftSupport(workbench: Workbench): boolean {
        return Fs.existsSync(Path.join(workbench.path.toString(), "common/bin/projectmanager.json"))
            && Fs.existsSync(Path.join(workbench.path.toString(), "common/bin/IarServiceLauncher" + IarOsUtils.executableExtension()));
    }

    // Loaded project contexts are stored, and may be reused until this workbench is disposed of, or the project is unloaded
    private readonly loadedContexts = new Map<string, ProjectContext>();

    // To avoid conflicting operations running at the same time (e.g. loading and unloading the same project
    // concurrently), we only allow one operation at a time.
    private readonly mtx = new Mutex();

    constructor(public workbench: Workbench,
        private readonly serviceMgr: ThriftServiceManager,
        private readonly projectMgr: ThriftClient<ProjectManager.Client>) {
    }

    public loadWorkspace(workspace: EwWorkspace): Promise<ThriftWorkspace> {
        if (!WorkbenchFeatures.supportsFeature(this.workbench, WorkbenchFeatures.PMWorkspaces)) {
            throw new Error("Tried to load workspace with unsupported toolchain");
        }
        return this.mtx.runExclusive(async() => {
            logger.debug(`Loading thrift workspace: ${workspace.name}`);
            // Remove backups so this has the same behavior as loadProject
            await BackupUtils.doWithBackupCheck(workspace.projects, async() => {
                await this.projectMgr.service.LoadEwwFile(workspace.path);
            });

            const contexts = await this.projectMgr.service.GetLoadedProjects();
            this.loadedContexts.clear();
            for (const projFile of workspace.projects) {
                const context = contexts.find(ctx => OsUtils.pathsEqual(ctx.filename, projFile));
                if (!context) {
                    Vscode.window.showErrorMessage(`Failed to load workspace project: ${projFile}`);
                } else {
                    this.loadedContexts.set(projFile, context);
                }
            }
            logger.debug(`Successfully loaded ${this.loadedContexts.size} projects in workspace`);
            return ThriftWorkspace.fromService(this.workbench, this.projectMgr.service, workspace.path);
        });
    }

    public closeWorkspace(): Promise<void> {
        if (!WorkbenchFeatures.supportsFeature(this.workbench, WorkbenchFeatures.PMWorkspaces)) {
            throw new Error("Tried to close workspace with unsupported toolchain");
        }
        return this.mtx.runExclusive(async() => {
            logger.debug("Closing thrift workspace");
            await this.projectMgr.service.CloseWorkspace();
            this.loadedContexts.clear();
        });
    }

    public loadProject(project: Project): Promise<ThriftProject> {
        return this.mtx.runExclusive(async() => {
            logger.debug("Loading " + project.name);
            let context = this.loadedContexts.get(project.path.toString());
            if (context === undefined) {
                logger.debug(`Loading project context for '${project.name}'`);
                // VSC-192 Remove erroneous backup files created by some EW versions.
                context = await BackupUtils.doWithBackupCheck(project.path, async() => {
                    return await this.projectMgr.service.LoadEwpFile(project.path);
                });
                this.loadedContexts.set(project.path, context);
            }
            return ThriftProject.fromContext(project.path, this.projectMgr.service, context, this.workbench);
        });
    }

    public unloadProject(project: Project): Promise<void> {
        return this.mtx.runExclusive(async() => {
            logger.debug("Unloading " + project.name);
            const context = this.loadedContexts.get(project.path);
            if (context !== undefined) {
                if (WorkbenchFeatures.supportsFeature(this.workbench, WorkbenchFeatures.PMWorkspaces)) {
                    await this.projectMgr.service.RemoveProject(context);
                } else {
                    await this.projectMgr.service.CloseProject(context);
                }
                this.loadedContexts.delete(project.path);
            }
        });
    }

    public async dispose() {
        logger.debug(`Shutting down thrift workbench '${this.workbench.name}'`);
        await this.mtx.runExclusive(async() => {
            // unload all loaded projects
            const contexts = await Promise.allSettled(this.loadedContexts.values());
            await Promise.allSettled(contexts.map(result => {
                if (result.status === "fulfilled") {
                    return this.projectMgr.service.CloseProject(result.value);
                }
                return Promise.resolve();
            }));
            this.projectMgr.close();
            await this.serviceMgr.dispose();
        });
    }

    public onCrash(handler: (code: number | null) => void) {
        this.serviceMgr.addCrashHandler(handler);
    }
}
