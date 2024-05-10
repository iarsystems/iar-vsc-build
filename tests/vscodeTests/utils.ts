/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import * as Assert from "assert";
// import { WorkbenchFeatures } from "iar-vsc-common/workbenchfeatureregistry";
import * as Vscode from "vscode";
import { ExtensionState } from "../../src/extension/extensionstate";
import { TestConfiguration } from "../testconfiguration";

export namespace VscodeTestsUtils {

    /**
     * Waits for the extension to be activated, and selects an appopriate workbench to test with.
     */
    export async function doExtensionSetup() {
        const ext = Vscode.extensions.getExtension("iarsystems.iar-build");
        Assert(ext, "Extension is not installed, did its name change?");
        await ext?.activate();
        // Detecting workspaces and toolchains is done *after* activating, but we want that finished before we run any tests
        const wbPromise = new Promise<void>(resolve => {
            if (ExtensionState.getInstance().workbenches.items.length > 0) {
                resolve();
            } else {
                ExtensionState.getInstance().workbenches.addOnInvalidateHandler(() => resolve());
            }
        });
        const wsPromise = new Promise<void>(resolve => {
            if (ExtensionState.getInstance().workspaces.items.length > 0) {
                resolve();
            } else {
                ExtensionState.getInstance().workspaces.addOnInvalidateHandler(() => resolve());
            }
        });
        await Promise.all([wbPromise, wsPromise]);

        // Select the workbench to test with
        const workbenchModel = ExtensionState.getInstance().workbenches;
        const candidates = workbenchModel.items.filter(workbench => workbench.targetIds.includes(TestConfiguration.getConfiguration().target));
        Assert(candidates.length > 0, "Found no workbench for target " + TestConfiguration.getConfiguration().target);
        // Prioritize newer workbench versions
        const candidatesPrioritized = candidates.sort((wb1, wb2) =>
            (wb2.version.major - wb1.version.major) || (wb2.version.minor - wb1.version.minor) || (wb2.version.patch - wb1.version.patch));
        workbenchModel.selectWhen(item => item === candidatesPrioritized[0]);
    }

    // ---- Helpers for interacting with the extension configuration UI


    export async function activateProject(projectLabel: string) {
        const workspace = await ExtensionState.getInstance().workspace.getValue();
        if (workspace) {
            if (workspace.projects.selected?.name !== projectLabel) {
                workspace.projects.selectWhen(project => project.name === projectLabel);
                // if (TestConfiguration.getConfiguration().testThriftSupport) {
                //     await VscodeTestsUtils.projectLoaded(projectLabel);
                // }
            }
        }
    }

    export function activateWorkspace(workspaceLabel: string) {
        // const workspace = await ExtensionState.getInstance().workspace.getValue();
        if (ExtensionState.getInstance().workspaces.selected?.name !== workspaceLabel) {
            ExtensionState.getInstance().workspaces.selectWhen(workspace => workspace.name === workspaceLabel);
        }
        // if (TestConfiguration.getConfiguration().testThriftSupport && workspace?.name !== workspaceLabel) {
        //     await VscodeTestsUtils.workspaceLoaded(workspaceLabel);
        // }
    }

    export async function activateConfiguration(configurationTag: string) {
        const workspace = await ExtensionState.getInstance().workspace.getValue();
        if (workspace) {
            workspace.projectConfigs.selectWhen(conf => conf.name === configurationTag);
        }
    }

    export async function activateWorkbench(ew: string) {
        if (ExtensionState.getInstance().workbenches.selected?.name !== ew) {
            ExtensionState.getInstance().workbenches.selectWhen(workbench => workbench.name === ew);
            if (TestConfiguration.getConfiguration().testThriftSupport) {
                await VscodeTestsUtils.workspaceLoaded();
            }
        }
    }

    export function workspaceLoaded(name?: string) {
        return new Promise<void>((resolve, reject) => {
            ExtensionState.getInstance().workspace.onValueDidChange((ws) => {
                if (ws !== undefined && (name === undefined || ws.name === name)) {
                    resolve();
                }
            });
            setTimeout(() => {
                reject(new Error("Timed out waiting for workspace to load."));
            }, 30000);
        });
    }


    export async function executeCommand<T>(commandId: string, item: T): Promise<void> {
        await Vscode.commands.executeCommand(commandId, item);
    }

    // ---- Helpers for running tasks

    /**
     * Execute a task and return a promise to keep track of the completion. The promise is resolved when
     * the matcher returns true.
     * @param task
     * @param matcher
     * @returns
     */
     export async function executeTask(task: Vscode.Task, matcher: (taskEvent: Vscode.TaskEndEvent) => boolean) {
         await Vscode.tasks.executeTask(task);

         return waitForTask(matcher);
     }

    export function waitForTask(matcher: (taskEvent: Vscode.TaskEndEvent) => boolean): Promise<void> {
        return new Promise<void>(resolve => {
            const disposable = Vscode.tasks.onDidEndTask(e => {
                if (matcher(e)) {
                    disposable.dispose();
                    resolve();
                }
            });
        });
    }

    /**
     * Run a task with the given name for the a project and configuration. Returns a promise that resolves
     * once the task has been executed.
     * @param taskName
     * @param projectName
     * @param configuration
     * @returns
     */
    export async function runTaskForProject(taskName: string, projectName: string, configuration: string) {
        // To have the call to vscode.tasks working the activate calls needs to be awaited.
        await activateProject(projectName);
        await activateConfiguration(configuration);

        return runTask(taskName);
    }
    export function runTask(taskName: string) {
        // Fetch the tasks and execute the build task.
        return Vscode.tasks.fetchTasks().then(async(listedTasks) => {
            // Locate the right task
            const theTask = listedTasks.find((task) => {
                return task.name === taskName;
            });
            Assert(theTask, "Failed to locate " + taskName);

            // Execute the task and wait for it to complete
            await executeTask(theTask, (e) => {
                return e.execution.task.name === taskName;
            });
        }, (reason) => {
            Assert.fail(reason);
        });
    }
}