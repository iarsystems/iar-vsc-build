/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



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
import { IarOsUtils } from "iar-vsc-common/osUtils";
import { copyFile, writeFile } from "fs/promises";
import { ArgVarsFile } from "./project/argvarfile";
import { Mutex } from "async-mutex";
import { tmpdir } from "os";
import { createHash } from "crypto";
import { WorkbenchVersions } from "./tools/workbenchversionregistry";

/**
 * A workbench with some extra capabilities,
 * such as querying for toolchains (platforms) and loading {@link ExtendedProject}s.
 */
export interface ExtendedWorkbench {
    readonly workbench: Workbench;

    /**
     * Loads the given project into a {@link ExtendedProject}.
     * This method uses caching; loaded projects are kept in memory to speed up
     * subsequent loads of the same project. To evict a project from memory and
     * force it to be reloaded from disk, call {@link unloadProject}.
     */
    loadProject(project: Project): Promise<ExtendedProject>;
    /**
     * Loads the given .custom_argvars file, making the variables specified in it
     * available to subsequently loaded projects. This unloads *all* currently
     * loaded projects, invalidating all existing {@link ExtendedProject}
     * instances from this workbench.
     * The projects must be loaded again before they can be used.
     */
    loadArgVars(argVars: ArgVarsFile | undefined): Promise<void>;
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
        return Fs.existsSync(Path.join(workbench.path.toString(), "common/bin/projectmanager.json"))
            && Fs.existsSync(Path.join(workbench.path.toString(), "common/bin/IarServiceLauncher" + IarOsUtils.executableExtension()));
    }

    // Loaded project contexts are stored, and may be reused until this workbench is disposed of, or the project is unloaded
    private readonly loadedContexts = new Map<string, ProjectContext>();

    // To avoid conflicting operations running at the same time (e.g. loading and unloading the same project
    // concurrently), we only allow one operation at a time. This can probably be optimized to allow unrelated
    // operations (e.g. for separate projects) to run concurrently.
    private readonly mtx = new Mutex();

    constructor(public workbench:   Workbench,
                private readonly serviceMgr: ThriftServiceManager,
                private readonly projectMgr: ThriftClient<ProjectManager.Client>) {
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

    public loadArgVars(argVars: ArgVarsFile | undefined) {
        if (!WorkbenchVersions.doCheck(this.workbench, WorkbenchVersions.supportsPMWorkspaces)) {
            return Promise.resolve();
        }
        return this.mtx.runExclusive(async() => {
            logger.debug("Loading argvars file: " + argVars?.name);
            if (argVars) {
                // There is no direct thrift API for loading argvars files. Instead, loading an .eww file will automatically
                // load the .custom_argvars file with the same name. Thus, we create an empty .eww file next to the argvars file and load it.
                const tmpBasename = Path.join(tmpdir(), "iar-build", createHash("md5").update(argVars?.path).digest("hex"));
                Fs.mkdirSync(Path.dirname(tmpBasename), { recursive: true });
                await writeFile(tmpBasename + ".eww", this.ewwContents);
                await copyFile(argVars.path, tmpBasename + ".custom_argvars");
                await this.projectMgr.service.LoadEwwFile(tmpBasename + ".eww");
            } else {
                await this.projectMgr.service.CloseWorkspace();
            }
            this.loadedContexts.clear();
        });
    }

    public unloadProject(project: Project): Promise<void> {
        return this.mtx.runExclusive(async() => {
            logger.debug("Unloading " + project.name);
            const context = this.loadedContexts.get(project.path);
            if (context !== undefined) {
                this.loadedContexts.delete(project.path.toString());
                await this.projectMgr.service.CloseProject(context);
                this.loadedContexts.delete(project.path);
            }
        });
    }

    public async dispose() {
        logger.debug(`Shutting down thrift workbench '${this.workbench.name}'`);
        // unload all loaded projects
        const contexts = await Promise.allSettled(this.loadedContexts.values());
        await Promise.allSettled(contexts.map(result => {
            if (result.status === "fulfilled") {
                return this.projectMgr.service.CloseProject(result.value);
            }
            return Promise.resolve();
        }));
        this.projectMgr.close();
        await this.serviceMgr.stop();
    }

    public onCrash(handler: (code: number | null) => void) {
        this.serviceMgr.addCrashHandler(handler);
    }

    private readonly ewwContents = `<?xml version="1.0" encoding="UTF-8"?>
                                    <workspace>
                                        <batchBuild />
                                    </workspace>
                                    `;
}