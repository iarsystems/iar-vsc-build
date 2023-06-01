/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ExtendedProject, Project } from "../iar/project/project";
import { EwWorkspace, ExtendedEwWorkspace } from "../iar/workspace/ewworkspace";
import { AsyncObservable } from "../utils/asyncobservable";
import { Workbench } from "iar-vsc-common/workbench";
import { TaskQueue } from "../utils/taskqueue";
import { ExtendedWorkbench, ThriftWorkbench } from "../iar/extendedworkbench";
import { WorkbenchFeatures } from "iar-vsc-common/workbenchfeatureregistry";

type TaskSpecification =
    | { tag: "loadWorkbench"; workbench: Workbench | undefined }
    | { tag: "loadWorkspace"; workspace: EwWorkspace | undefined }
    | { tag: "loadProject"; project: Project | undefined }
    | { tag: "reloadProject"; project: Project };

/**
 * Manages the loading and unloading of workbenches, workspaces and projects.
 *
 * This is highly asynchronous business; this class takes ensures that
 * items are loaded safely and in the correct order.
 */
export class LoadingService {
    private readonly pendingTasks = new TaskQueue<TaskSpecification>();

    /**
     * Creates a new loading service. The given observables are used to broadcast loading/loaded
     * workbenches, workspaces and projects.
     */
    constructor(
        private readonly loadedWorkbench: AsyncObservable<ExtendedWorkbench>,
        private readonly loadedWorkspace: AsyncObservable<ExtendedEwWorkspace>,
        private readonly loadedProject:   AsyncObservable<ExtendedProject>,
    ) {
    }

    /**
     * Requests that the given workbench be loaded (as an {@link ExtendedWorkbench}).
     * This unloads any previously loaded workbench.
     */
    async loadWorkbench(workbench: Workbench | undefined) {
        await this.pushTask({ tag: "loadWorkbench", workbench });
    }

    /**
     * Requests that the given workspace be loaded (as an {@link ExtendedWorkspace}).
     * This uses the workbench from the last call to {@link loadWorkbench}, and unloads
     * any previously loaded workspace and/or projects.
     */
    async loadWorkspace(workspace: EwWorkspace | undefined) {
        await this.pushTask({ tag: "loadWorkspace", workspace });
    }

    /**
     * Requests that the given project be loaded (as an {@link ExtendedProject}).
     * This uses the workbench from the last call to {@link loadWorkbench}.
     */
    async loadProject(project: Project | undefined) {
        await this.pushTask({ tag: "loadProject", project });
    }

    /**
     * Requests that the given project be reloaded from disk.
     * This uses the workbench from the last call to {@link loadWorkbench}.
     * This does not affect any of the observables.
     */
    async reloadProject(project: Project) {
        await this.pushTask({ tag: "reloadProject", project });
    }

    private pushTask(specification: TaskSpecification): Promise<unknown> {
        // To save some time, we cancel previous tasks that are made obsolete by this one.
        switch (specification.tag) {
        case "loadWorkbench":
        {
            this.pendingTasks.cancelAll();
            const prevExtWb = this.loadedWorkbench.promise;

            const task = this.pendingTasks.pushTask(specification, () => {
                if (specification.workbench && ThriftWorkbench.hasThriftSupport(specification.workbench)) {
                    return ThriftWorkbench.from(specification.workbench);
                }
                return Promise.resolve(undefined);
            });

            this.loadedWorkbench.setWithPromise(task);
            this.loadedWorkspace.setWithPromise(task.then(() => undefined));
            this.loadedProject.setWithPromise(task.then(() => undefined));
            prevExtWb.then(prevWb => prevWb?.dispose());

            return task;
        }
        case "loadWorkspace":
        {
            this.pendingTasks.cancelWhile(it => ["loadProject", "reloadProject", "loadWorkspace"].includes(it.tag));

            const workbenchPromise = this.loadedWorkbench.promise.catch(() => undefined);
            const task = this.pendingTasks.pushTask(specification, async() => {
                const loadedWorkbench = await workbenchPromise;
                if (loadedWorkbench) {
                    if (!WorkbenchFeatures.supportsFeature(loadedWorkbench.workbench,
                        WorkbenchFeatures.PMWorkspaces)) {
                        return undefined;
                    }

                    if (specification.workspace) {
                        return loadedWorkbench.loadWorkspace(specification.workspace);
                    } else {
                        await loadedWorkbench.closeWorkspace();
                        return undefined;
                    }
                }
                return undefined;
            });

            this.loadedWorkspace.setWithPromise(task);
            this.loadedProject.setWithPromise(task.then(() => undefined));

            return task;
        }
        case "loadProject":
        {
            this.pendingTasks.cancelWhile(it => it.tag === "loadProject");

            const workbenchPromise = this.loadedWorkbench.promise.catch(() => undefined);
            const task = this.pendingTasks.pushTask(specification, async() => {
                if (specification.project) {
                    const loadedWorkbench = await workbenchPromise;
                    return loadedWorkbench?.loadProject(specification.project);
                }
                return undefined;
            });

            this.loadedProject.setWithPromise(task);

            return task;
        }
        case "reloadProject":
        {
            this.pendingTasks.cancelWhile(it => it.tag === "loadProject" && it.project === specification.project);

            const workbenchPromise = this.loadedWorkbench.promise.catch(() => undefined);
            return this.pendingTasks.pushTask(specification, async() => {
                const loadedWorkbench = await workbenchPromise;
                await loadedWorkbench?.reloadProject(specification.project);
            });
        }
        default:
        {
            // Checks that all task variants are handled
            const _exhaustiveCheck: never = specification;
            return _exhaustiveCheck;
        }
        }
    }
}