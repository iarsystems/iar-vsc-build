/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ExtendedEwWorkspace } from "./ewworkspace";
import { BatchBuildItem, ProjectContext } from "iar-vsc-common/thrift/bindings/projectmanager_types";
import { ExtendedProject, Project } from "../project/project";
import { logger } from "iar-vsc-common/logger";
import { OsUtils } from "iar-vsc-common/osUtils";
import * as ProjectManager from "iar-vsc-common/thrift/bindings/ProjectManager";
import { Workbench } from "iar-vsc-common/workbench";
import { WorkbenchFeatures } from "iar-vsc-common/workbenchfeatureregistry";
import * as vscode from "vscode";
import { IarVsc } from "../../extension/main";
import { BackupUtils, ErrorUtils, Utils } from "../../utils/utils";
import { ProjectHolder } from "../project/projectholder";
import { ThriftProject } from "../project/thrift/thriftproject";
import { EwwFile } from "./ewwfile";
import { Disposable } from "../../utils/disposable";
import { EwpFile } from "../project/parsing/ewpfile";
import { ProjectLock } from "../projectlock";

/**
 * The main {@link ExtendedEwWorkspace} implementation. Supports lazy-loading of
 * projects, so that they are only loaded when requested.
 */
export class ThriftWorkspace extends ExtendedEwWorkspace implements Disposable {
    private readonly currentOperations: Promise<unknown>[] = [];
    private readonly unfinishedLoadingOperations: Map<string, Promise<ThriftProject | undefined>> = new Map;

    /**
     * Loads a .eww file and all projects in it.
     * @param file The .eww file to load.
     * @param pm The project manager to use to the workspace.
     * @param owner The workbench that owns the project manager.
     */
    static async fromEwwFile(file: EwwFile, pm: ProjectManager.Client, owner: Workbench): Promise<ThriftWorkspace> {
        let loadedProjects: ThriftProject[] = [];
        const placeholderProjects: ProjectHolder[] = [];

        if (!WorkbenchFeatures.supportsFeature(owner, WorkbenchFeatures.PMWorkspaces)) {
            // Older workbenches do not support loading .eww files. In that case,
            // we can simply load all projects listed in the .eww file manually,
            // which gets us most of the way there.
            const projects = await EwwFile.getMemberProjects(file.path);
            await Promise.all(projects.map(async(projPath) => {
                const maybeLoaded = await loadThriftProject(projPath, pm, owner);
                if (maybeLoaded) {
                    loadedProjects.push(maybeLoaded);
                } else {
                    // Create a placeholder so we at least get intellisense for
                    // this project, and we can retry loading it later.
                    const placeholder = createPlaceholderProject(projPath);
                    if (placeholder) {
                        placeholderProjects.push(placeholder);
                    }
                }
            }));
        } else {
            const projects = await EwwFile.getMemberProjects(file.path);

            // See VSC-439
            if (!WorkbenchFeatures.supportsFeature(owner, WorkbenchFeatures.ToleratesCyclicProjectTrees)) {
                await Promise.all(projects.map(projFile => ThriftProject.removeDepFile(projFile)));
            }

            await ProjectLock.runExclusive(projects, async() => {
                // Remove automatically created backups, since we have no way of asking
                // the user whether they want them.
                await BackupUtils.doWithBackupCheck(projects, async() => {
                    await pm.LoadEwwFile(file.path);
                });
            });

            const contexts = await pm.GetProjects();
            for (const projFile of projects) {
                const context = contexts.find(ctx => OsUtils.pathsEqual(ctx.filename, projFile));
                if (!context) {
                    logger.error(`Failed to load workspace project: ${projFile}`);
                    vscode.window.showErrorMessage(`Failed to load workspace project: ${projFile}`);
                    // Create a placeholder so we at least get intellisense for
                    // this project, and we can retry loading it later.
                    const placeholder = createPlaceholderProject(projFile);
                    if (placeholder) {
                        placeholderProjects.push(placeholder);
                    }
                }
            }

            loadedProjects = (await Promise.all(contexts.map(
                ctx => createThriftProjectFromContext(ctx, pm, owner)
            ))).
                filter(Utils.notUndefined);
        }

        return new ThriftWorkspace(owner, pm, loadedProjects, placeholderProjects, file);
    }

    /**
     * Creates an "anonymous" workspace (with no .eww file).
     * @param projects The .ewp files to add to the workspace.
     * @param pm The project manager to use to load projects.
     * @param owner The workbench that owns the project manager.
     */
    static fromProjectPaths(projects: string[], pm: ProjectManager.Client, owner: Workbench): ThriftWorkspace {
        // Load all projects lazily
        const ewpFiles = projects.map(pr => createPlaceholderProject(pr)).filter(Utils.notUndefined);
        const placeholderProjects = ewpFiles.map(pr => new ProjectHolder(pr));
        return new ThriftWorkspace(owner, pm, [], placeholderProjects);
    }

    private constructor(
        private readonly owner: Workbench,
        private readonly pm: ProjectManager.Client,
        private loadedProjects: ThriftProject[],
        private nonloadedProjects: ProjectHolder[],
        workspace?: EwwFile
    ) {
        super(workspace, (loadedProjects as Project[]).concat(nonloadedProjects));
    }

    override getBatchBuilds(): Promise<BatchBuildItem[] | undefined> {
        if (!WorkbenchFeatures.supportsFeature(this.owner, WorkbenchFeatures.PMWorkspaces)) {
            return Promise.resolve(undefined);
        }

        return this.performOperation(async() => {
            return await this.pm.GetBatchBuildItems();
        });
    }
    override setBatchBuilds(items: BatchBuildItem[]): Promise<void> {
        if (!WorkbenchFeatures.supportsFeature(this.owner, WorkbenchFeatures.PMWorkspaces)) {
            return Promise.resolve();
        }

        return this.performOperation(async() => {
            await this.pm.SetBatchBuildItems(items);

            if (!this.path) {
                // This is an anonymous workspace, we have no file to save to.
                return;
            }
            IarVsc.ewwWatcher?.supressNextFileModificationFor(this.path);
            await this.pm.SaveEwwFile();
        });
    }

    override async getExtendedProject(project?: Project): Promise<ExtendedProject | undefined> {
        project ??= this.projects.selected;
        if (!project) {
            return undefined;
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const existing = this.loadedProjects.find(lp => OsUtils.pathsEqual(lp.path, project!.path));
        if (existing) {
            return existing;
        }

        if (this.unfinishedLoadingOperations.has(project.path)) {
            return this.unfinishedLoadingOperations.get(project.path);
        }

        const proxy = this.nonloadedProjects.find(proj => proj === project);
        if (!proxy) {
            return undefined;
        }
        this.nonloadedProjects.splice(this.nonloadedProjects.indexOf(proxy), 1);

        logger.debug("Lazy-loading project: " + project.name);
        const promise = ThriftProject.load(project.path, this.pm, this.owner).
            catch(e => {
                const errMsg = ErrorUtils.toErrorMessage(e);
                logger.error(`Failed to load '${project?.path}': ${errMsg}`);
                vscode.window.showErrorMessage(`IAR: Failed to load project '${project?.path}': ${errMsg}`);
                return undefined;
            });
        this.unfinishedLoadingOperations.set(project.path, promise);
        promise.then(loaded => {
            if (loaded) {
                proxy.setProject(loaded);
                this.loadedProjects.push(loaded);
            }
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.unfinishedLoadingOperations.delete(project!.path);
        });
        return await promise;
    }

    async dispose(): Promise<void> {
        logger.debug(`(${this.owner.name}) Disposing of workspace: ${this.name}`);
        await Promise.allSettled(this.currentOperations);

        this.nonloadedProjects = [];
        const loadedProjects = this.loadedProjects;
        this.loadedProjects = [];
        await Promise.allSettled(loadedProjects.map(proj => proj.dispose().catch(e => logger.warn(`Failed to dispose of project '${proj.name}': ${e}`)))
        );

        if (WorkbenchFeatures.supportsFeature(this.owner, WorkbenchFeatures.PMWorkspaces)) {
            await this.pm.CloseWorkspace();
        }
    }

    // Registers an operation that uses the thrift project manager. The
    // operation will be awaited before unloading the workspace (as long as the
    // owner of this instance calls {@link dispose}).
    // ! All thrift procedure calls should go through this method.
    private performOperation<T>(operation: () => Promise<T>): Promise<T> {
        const promise = operation();
        this.currentOperations.push(promise);
        promise.finally(() => this.currentOperations.splice(this.currentOperations.indexOf(promise), 1));
        return promise;
    }
}

// -- Helpers for safely loading projects --

async function loadThriftProject(
    file: string,
    pm: ProjectManager.Client,
    owner: Workbench
): Promise<ThriftProject | undefined> {
    try {
        logger.debug(`Loading project: ${file}`);
        return await ThriftProject.load(file, pm, owner);
    } catch (e) {
        const errMsg = ErrorUtils.toErrorMessage(e);
        logger.error(`Failed to load '${file}': ${errMsg}`);
        vscode.window.showErrorMessage(`IAR: Failed to load project '${file}': ${errMsg}`);
        return undefined;
    }
}

async function createThriftProjectFromContext(
    context: ProjectContext,
    pm: ProjectManager.Client,
    owner: Workbench
): Promise<ThriftProject | undefined> {
    try {
        return await ThriftProject.fromContext(context, pm, owner);
    } catch (e) {
        const errMsg = ErrorUtils.toErrorMessage(e);
        logger.error(`Failed to load '${context.filename}': ${errMsg}`);
        vscode.window.showErrorMessage(`IAR: Failed to load project '${context.filename}': ${errMsg}`);
        return undefined;
    }
}

function createPlaceholderProject(file: string): ProjectHolder | undefined {
    try {
        logger.debug(`Parsing project: ${file}`);
        return new ProjectHolder(new EwpFile(file));
    } catch (e) {
        const errMsg = ErrorUtils.toErrorMessage(e);
        logger.error(`Failed to parse '${file}': ${errMsg}`);
        vscode.window.showErrorMessage(`IAR: Failed to parse project '${file}': ${errMsg}`);
        return undefined;
    }

}

