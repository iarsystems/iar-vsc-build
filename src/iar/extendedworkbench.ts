/* this source code form is subject to the terms of the mozilla public
 * license, v. 2.0. if a copy of the mpl was not distributed with this
 * file, you can obtain one at https://mozilla.org/mpl/2.0/. */



import * as ProjectManager from "iar-vsc-common/thrift/bindings/ProjectManager";
import * as Fs from "fs";
import * as Path from "path";
import { Workbench } from "iar-vsc-common/workbench";
import { Toolchain, PROJECTMANAGER_ID, ProjectContext } from "iar-vsc-common/thrift/bindings/projectmanager_types";
import { ExtendedProject, Project } from "./project/project";
import { ThriftServiceManager } from "./project/thrift/thriftservicemanager";
import { ThriftClient } from "iar-vsc-common/thrift/thriftClient";
import { QtoPromise } from "../utils/promise";
import { ThriftProject } from "./project/thrift/thriftproject";
import { BackupUtils } from "../utils/utils";
import { logger } from "iar-vsc-common/logger";

/**
 * A workbench with some extra capabilities,
 * such as querying for toolchains (platforms) and loading {@link ExtendedProject}s.
 */
export interface ExtendedWorkbench {
    readonly workbench: Workbench;

    getToolchains(): Promise<Toolchain[]>;

    /**
     * Loads the given project into a {@link ExtendedProject}.
     * This method uses caching; loaded projects are kept in memory to speed up
     * subsequent loads of the same project. To evict a project from memory and
     * force it to be reloaded from disk, call {@link unloadProject}.
     */
    loadProject(project: Project): Promise<ExtendedProject>;
    /**
     * Unloads the given project if it has previously been loaded.
     * The next time the project is loaded using this workbench, a full load from
     * disk will be performed.
     * Note that this invalidates all currently loaded instances of the project.
     */
    unloadProject(project: Project): Promise<void>;

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
        const serviceManager = await ThriftServiceManager.fromWorkbench(workbench);
        const projectManager = await serviceManager.findService(PROJECTMANAGER_ID, ProjectManager);
        return new ThriftWorkbench(workbench, serviceManager, projectManager);
    }

    static hasThriftSupport(workbench: Workbench): boolean {
        // TODO: find a better way to do this
        return Fs.existsSync(Path.join(workbench.path.toString(), "common/bin/projectmanager.json"));
    }

    // Loaded project contexts are stored, and may be reused until this workbench is disposed of.
    private readonly loadedContexts = new Map<string, Promise<ProjectContext>>();
    // To avoid unloading and unloading the same project at the same time, store active unload tasks here and await them when loading
    private readonly currentUnloadTasks = new Map<string, Promise<void>>();

    constructor(public workbench:   Workbench,
                private readonly serviceMgr: ThriftServiceManager,
                private readonly projectMgr: ThriftClient<ProjectManager.Client>) {
    }

    public getToolchains() {
        return QtoPromise(this.projectMgr.service.GetToolchains());
    }

    public async loadProject(project: Project): Promise<ThriftProject> {
        const unloadTask = this.currentUnloadTasks.get(project.path);
        if (unloadTask) {
            await unloadTask;
        }

        let contextPromise = this.loadedContexts.get(project.path.toString());
        if (contextPromise === undefined) {
            logger.debug(`Loading project context for '${project.name}'`);
            // VSC-192 Remove erroneous backup files created by some EW versions.
            contextPromise = BackupUtils.doWithBackupCheck(project.path, async() => {
                return await this.projectMgr.service.LoadEwpFile(project.path);
            });
            this.loadedContexts.set(project.path, contextPromise);
            contextPromise.catch(() => this.loadedContexts.delete(project.path));
        }
        return contextPromise.then(context => ThriftProject.fromContext(project.path, this.projectMgr.service, context, this.workbench));
    }

    public async unloadProject(project: Project): Promise<void> {
        const contextPromise = this.loadedContexts.get(project.path.toString());
        if (contextPromise !== undefined && !this.currentUnloadTasks.has(project.path)) {

            const unloadTask = contextPromise.then(context => {
                this.loadedContexts.delete(project.path.toString());
                return this.projectMgr.service.CloseProject(context);
            });

            this.currentUnloadTasks.set(project.path, unloadTask);
            unloadTask.finally(() => {
                this.currentUnloadTasks.delete(project.path);
            });
            await unloadTask;
        }
    }

    public async dispose() {
        logger.debug(`Shutting down thrift workbench '${this.workbench.name}'`);
        // unload all loaded projects
        const contexts = await Promise.allSettled(this.loadedContexts.values());
        await Promise.allSettled(contexts.map(result => {
            if (result.status === "fulfilled") {
                this.projectMgr.service.CloseProject(result.value);
            }
        }));
        this.projectMgr.close();
        await this.serviceMgr.stop();
    }

    public onCrash(handler: (code: number | null) => void) {
        this.serviceMgr.addCrashHandler(handler);
    }
}