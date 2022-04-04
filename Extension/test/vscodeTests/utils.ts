import * as Assert from "assert";
import * as Vscode from "vscode";
import { ExtensionState } from "../../src/extension/extensionstate";

export namespace VscodeTestsUtils {

    // Waits for the extension to be activated.
    export async function ensureExtensionIsActivated() {
        const ext = Vscode.extensions.getExtension("iarsystems.iar-build");
        Assert(ext, "Extension is not installed, did its name change?");
        await ext?.activate();
    }

    // ---- Helpers for interacting with the extension configuration UI


    export async function activateProject(projectLabel: string) {
        if (ExtensionState.getInstance().project.selected?.name !== projectLabel) {
            await Promise.all([
                VscodeTestsUtils.projectLoaded(),
                ExtensionState.getInstance().project.selectWhen(project => project.name === projectLabel),
            ]);
        }
    }

    export async function activateConfiguration(configurationTag: string) {
        if (ExtensionState.getInstance().config.selected?.name !== configurationTag) {
            await Promise.all([
                ExtensionState.getInstance().config.selectWhen(config => config.name === configurationTag),
            ]);
        }
    }

    export async function activateWorkbench(ew: string) {
        if (ExtensionState.getInstance().workbench.selected?.name !== ew) {
            await Promise.all([
                VscodeTestsUtils.projectLoaded(),
                ExtensionState.getInstance().workbench.selectWhen(workbench => workbench.name === ew),
            ]);
        }
    }

    // Waits until the loaded project changes. Useful e.g. after activating a project to ensure it has loaded completely.
    export function projectLoaded() {
        return new Promise<void>((resolve, reject) => {
            let resolved = false;
            ExtensionState.getInstance().extendedProject.onValueDidChange((proj) => {
                if (proj !== undefined && !resolved) {
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