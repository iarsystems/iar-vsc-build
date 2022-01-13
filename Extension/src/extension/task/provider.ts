/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import * as Path from "path";

import { BuildTasks } from "./buildtasks";
import { OpenTasks } from "./opentasks";

export namespace IarTaskProvider {
    let tasks: Vscode.Task[] = [];
    let taskProvider: Vscode.Disposable | undefined = undefined;
    let watcher: Vscode.FileSystemWatcher | undefined = undefined;

    export function register(): void {
        if (!taskProvider) {
            taskProvider = Vscode.tasks.registerTaskProvider("iar", {
                provideTasks: () => {
                    if (tasks.length === 0) {
                        tasks = getTasks();
                    }

                    return tasks;
                },
                resolveTask: (_task: Vscode.Task) => {
                    const definition = _task.definition;
                    if (definition["command"] === "open") {
                        return OpenTasks.generateFromDefinition(definition);
                    } else {
                        return BuildTasks.generateFromDefinition(definition);

                    }
                }
            });
        }

        if (!watcher) {
            const workspaceFolder = Vscode.workspace.rootPath;

            if (workspaceFolder) {
                const tasksPath = Path.join(workspaceFolder, ".vscode", "tasks.json");
                watcher = Vscode.workspace.createFileSystemWatcher(tasksPath);

                watcher.onDidChange(() => {
                    tasks = [];
                });
                watcher.onDidCreate(() => {
                    tasks = [];
                });
                watcher.onDidDelete(() => {
                    tasks = [];
                });
            }
        }
    }

    export function unregister(): void {
        if (taskProvider) {
            taskProvider.dispose();
            taskProvider = undefined;
        }

        if (watcher) {
            watcher.dispose();
        }

        tasks = [];
    }

    function getTasks(): Vscode.Task[] {
        const tasks = new Map<string, Vscode.Task>();

        BuildTasks.generateTasks(tasks);
        OpenTasks.generateTasks(tasks);

        return Array.from(tasks.values());
    }
}
