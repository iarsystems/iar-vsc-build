// TODO: remove this comment once VSC-5 has been closed, it should remove all any:s in this file
/* eslint-disable @typescript-eslint/no-explicit-any */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import * as Fs from "fs";
import * as Path from "path";
import * as Jsonc from "jsonc-parser";

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
                    return undefined;
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

        const json = readTasksJson();

        if (json !== undefined) {
            BuildTasks.generateFromTasksJson(json, tasks);
            OpenTasks.generateFromTasksJson(json, tasks);
        }

        BuildTasks.generateTasks(tasks);
        OpenTasks.generateTasks(tasks);

        return Array.from(tasks.values());
    }

    function readTasksJson(): any | undefined {
        const workspaceFolders = Vscode.workspace.workspaceFolders;

        if (workspaceFolders === undefined) {
            return undefined;
        }

        const workspaceFolder = workspaceFolders[0];

        if (workspaceFolder === undefined) {
            return undefined;
        }

        const path = Path.join(workspaceFolder.uri.fsPath, ".vscode", "tasks.json");

        try {
            const stat = Fs.statSync(path);

            if (!stat.isFile()) {
                return undefined;
            }
        } catch (e) {
            return undefined;
        }

        return Jsonc.parse(Fs.readFileSync(path, { encoding: "utf8" }));
    }
}
