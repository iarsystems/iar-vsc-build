/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as vscode from "vscode";
import { EwwFile } from "../iar/workspace/ewwfile";
import { AsyncObservable } from "../utils/asyncobservable";
import { Workbench } from "iar-vsc-common/workbench";
import { TaskQueue } from "../utils/taskqueue";
import { ExtendedWorkbench, ThriftWorkbench } from "../iar/extendedworkbench";
import { SimpleWorkspace, EwWorkspace } from "../iar/workspace/ewworkspace";
import { logger } from "iar-vsc-common/logger";
import { ErrorUtils } from "../utils/utils";

type TaskSpecification =
    | { tag: "loadWorkbench"; workbench: Workbench | undefined }
    | { tag: "loadWorkspace"; type: "file", workspace: EwwFile | undefined }
    | { tag: "loadWorkspace"; type: "anonymous", projects:  string[] };

/**
 * Manages the loading and unloading of workbenches, workspaces and projects.
 *
 * This is highly asynchronous business; this class takes ensures that
 * items are loaded safely and in the correct order.
 */
export class LoadingService {
    private readonly pendingTasks = new TaskQueue<TaskSpecification>();

    /**
     * Creates a new loading service. The given observables are used to
     * broadcast loading/loaded workbenches and workspaces.
     */
    constructor(
        private readonly loadedWorkbench: AsyncObservable<ExtendedWorkbench>,
        private readonly loadedWorkspace: AsyncObservable<EwWorkspace>,
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
     * Requests that the given workspace file be loaded (as a
     * {@link EwWorkspace}). This uses the workbench from the last call to
     * {@link loadWorkbench}, and unloads any previously loaded workspace.
     */
    async loadWorkspace(workspace: EwwFile | undefined) {
        await this.pushTask({ tag: "loadWorkspace", type: "file", workspace });
    }

    /**
     * Requests that the given projects be loaded (as a {@link EwWorkspace}).
     * This is provided for compatibility with older workbenches, and for users
     * who prefer working without .eww files. This uses the workbench from the
     * last call to {@link loadWorkbench}, and unloads any previously loaded
     * workspace.
     */
    async loadAnonymousWorkspace(projects: string[]) {
        await this.pushTask({ tag: "loadWorkspace", type: "anonymous", projects });
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
                prevExtWb.then(prevWb => prevWb?.dispose());

                return task;
            }
            case "loadWorkspace":
            {
                this.pendingTasks.cancelWhile(it => ["loadWorkspace"].includes(it.tag));

                const workbenchPromise = this.loadedWorkbench.promise.catch(() => undefined);
                const task = this.pendingTasks.pushTask(specification, async() => {
                    const loadedWorkbench = await workbenchPromise;
                    if (loadedWorkbench) {
                        if (specification.type === "file") {
                            if (specification.workspace) {
                                try {
                                    return loadedWorkbench.loadWorkspace(specification.workspace);
                                } catch (e) {
                                    const errorMsg = ErrorUtils.toErrorMessage(e);
                                    logger.error(`Failed to load workspace '${specification.workspace.path}': ${errorMsg}`);
                                    vscode.window.showErrorMessage("IAR: Failed to load workspace, some functionality may be unavailable: " + errorMsg);
                                }
                            } else {
                                await loadedWorkbench.closeWorkspace();
                            }
                        } else {
                            try {
                                return loadedWorkbench.loadAnonymousWorkspace(specification.projects);
                            } catch (e) {
                                const errorMsg = ErrorUtils.toErrorMessage(e);
                                logger.error(`Failed to load workspace: ${errorMsg}`);
                                vscode.window.showErrorMessage("IAR: Failed to load workspace, some functionality may be unavailable: " + errorMsg);
                            }
                        }
                    }

                    // Fall back to an xml-based workspace if we can't use thrift
                    if (specification.type === "file" && specification.workspace) {
                        return SimpleWorkspace.fromEwwFile(specification.workspace);
                    } else if (specification.type === "anonymous") {
                        return SimpleWorkspace.fromProjectPaths(specification.projects);
                    }
                    return undefined;
                });

                this.loadedWorkspace.setWithPromise(task);

                return task;
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