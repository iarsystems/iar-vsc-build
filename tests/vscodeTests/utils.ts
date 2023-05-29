/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import * as Assert from "assert";
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
        // Detecting projects and toolchains is done *after* activating, but we want that finished before we run any tests
        const wbPromise = ExtensionState.getInstance().workbench.amount > 0 ? Promise.resolve() : new Promise((resolve, _) => {
            ExtensionState.getInstance().workbench.addOnInvalidateHandler(resolve);
        });
        const projectPromise = ExtensionState.getInstance().project.amount > 0 ? Promise.resolve() : new Promise((resolve, _) => {
            ExtensionState.getInstance().project.addOnInvalidateHandler(resolve);
        });
        await Promise.all([wbPromise, projectPromise]);

        // Select the workbench to test with
        const workbenchModel = ExtensionState.getInstance().workbench;
        const candidates = workbenchModel.workbenches.filter(workbench => workbench.targetIds.includes(TestConfiguration.getConfiguration().target));
        Assert(candidates.length > 0, "Found no workbench for target " + TestConfiguration.getConfiguration().target);
        // Prioritize newer workbench versions
        const candidatesPrioritized = candidates.sort((wb1, wb2) =>
            (wb2.version.major - wb1.version.major) || (wb2.version.minor - wb1.version.minor) || (wb2.version.patch - wb1.version.patch));
        workbenchModel.selectWhen(item => item === candidatesPrioritized[0]);
    }

    // ---- Helpers for interacting with the extension configuration UI


    export async function activateProject(projectLabel: string) {
        if ((await ExtensionState.getInstance().extendedProject.getValue())?.name !== projectLabel) {
            ExtensionState.getInstance().project.selectWhen(project => project.name === projectLabel);
            if (TestConfiguration.getConfiguration().testThriftSupport) {
                await VscodeTestsUtils.projectLoaded(projectLabel);
            }
        }
    }

    export async function activateWorkspace(workspaceLabel: string) {
        const toSelectFrom: any = ExtensionState.getInstance().workspace.workspaces;
        console.log(toSelectFrom);
        if ((await ExtensionState.getInstance().workspace.selected?.name !== workspaceLabel)) {
            ExtensionState.getInstance().workspace.selectWhen(workspace => workspace.name === workspaceLabel);
        }
        if (TestConfiguration.getConfiguration().testThriftSupport &&
            (await ExtensionState.getInstance().loadedWorkspace.getValue())?.name !== workspaceLabel) {
            await VscodeTestsUtils.workspaceLoaded(workspaceLabel);
        }
    }

    export function activateConfiguration(configurationTag: string) {
        if (ExtensionState.getInstance().config.selected?.name !== configurationTag) {
            Assert(ExtensionState.getInstance().config.selectWhen(config => config.name === configurationTag));
        }
    }

    export async function activateWorkbench(ew: string) {
        if (ExtensionState.getInstance().workbench.selected?.name !== ew) {
            ExtensionState.getInstance().workbench.selectWhen(workbench => workbench.name === ew);
            if (TestConfiguration.getConfiguration().testThriftSupport) {
                await VscodeTestsUtils.projectLoaded();
            }
        }
    }

    // Waits until the loaded project changes. Useful e.g. after activating a project to ensure it has loaded completely.
    export async function projectLoaded(name?: string) {
        if ((await ExtensionState.getInstance().extendedWorkbench.getValue()) === undefined) {
            return Promise.reject(new Error("No thrift workbench available, did it crash in a previous test?"));
        }
        return new Promise<void>((resolve, reject) => {
            let resolved = false;
            ExtensionState.getInstance().extendedProject.onValueDidChange((proj) => {
                if (proj !== undefined && !resolved && (name === undefined || proj.name === name)) {
                    resolved = true;
                    resolve();
                }
            });
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    reject(new Error("Timed out waiting for project to load."));
                }
            }, 30000);
        });
    }

    export async function workspaceLoaded(name: string) {
        if ((await ExtensionState.getInstance().extendedWorkbench.getValue()) === undefined) {
            return Promise.reject(new Error("No thrift workbench available, did it crash in a previous test?"));
        }
        return new Promise<void>((resolve, reject) => {
            ExtensionState.getInstance().loadedWorkspace.onValueDidChange((ws) => {
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