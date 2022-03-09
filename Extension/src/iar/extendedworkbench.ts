/* this source code form is subject to the terms of the mozilla public
 * license, v. 2.0. if a copy of the mpl was not distributed with this
 * file, you can obtain one at https://mozilla.org/mpl/2.0/. */



import * as ProjectManager from "./project/thrift/bindings/ProjectManager";
import * as Fs from "fs";
import * as Path from "path";
import { Workbench } from "./tools/workbench";
import { Toolchain, PROJECTMANAGER_ID, ProjectContext } from "./project/thrift/bindings/projectmanager_types";
import { ExtendedProject, Project } from "./project/project";
import { ThriftServiceManager } from "./project/thrift/thriftservicemanager";
import { ThriftClient } from "./project/thrift/thriftclient";
import { QtoPromise } from "../utils/promise";
import { ThriftProject } from "./project/thrift/thriftproject";
import { BackupUtils } from "../utils/utils";

/**
 * A workbench with some extra capabilities,
 * such as querying for toolchains (platforms) and loading {@link ExtendedProject}s.
 */
export interface ExtendedWorkbench {
    readonly workbench: Workbench;

    getToolchains(): Promise<Toolchain[]>;

    loadProject(project: Project): Promise<ExtendedProject>;

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

    constructor(public workbench:   Workbench,
                private readonly serviceMgr: ThriftServiceManager,
                private readonly projectMgr: ThriftClient<ProjectManager.Client>) {
    }

    public getToolchains() {
        return QtoPromise(this.projectMgr.service.GetToolchains());
    }

    public loadProject(project: Project): Promise<ThriftProject> {
        let contextPromise = this.loadedContexts.get(project.path.toString());
        if (contextPromise === undefined) {
            // VSC-192 Remove erroneous backup files created by some EW versions.
            contextPromise = BackupUtils.doWithBackupCheck(project.path.toString(), async() => {
                return await this.projectMgr.service.LoadEwpFile(project.path.toString());
            });
            this.loadedContexts.set(project.path.toString(), contextPromise);
            contextPromise.catch(() => this.loadedContexts.delete(project.path.toString()));
        }
        return contextPromise.then(context => ThriftProject.fromContext(project.path, this.projectMgr.service, context));
    }

    public async dispose() {
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