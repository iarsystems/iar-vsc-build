
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
            let workspaceFolder = Vscode.workspace.rootPath;

            if (workspaceFolder) {
                let tasksPath = Path.join(workspaceFolder, ".vscode", "tasks.json");
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
        let tasks = new Map<string, Vscode.Task>();

        let json = readTasksJson();

        if (json !== undefined) {
            BuildTasks.generateFromTasksJson(json, tasks);
            OpenTasks.generateFromTasksJson(json, tasks);
        }

        BuildTasks.generateTasks(tasks);
        OpenTasks.generateTasks(tasks);

        return Array.from(tasks.values());
    }

    function readTasksJson(): any | undefined {
        let workspaceFolders = Vscode.workspace.workspaceFolders;

        if (workspaceFolders === undefined) {
            return undefined;
        }

        let workspaceFolder = workspaceFolders[0];

        if (workspaceFolder === undefined) {
            return undefined;
        }

        let path = Path.join(workspaceFolder.uri.fsPath, ".vscode", "tasks.json");

        try {
            let stat = Fs.statSync(path);

            if (!stat.isFile()) {
                return undefined;
            }
        } catch (e) {
            return undefined;
        }

        return Jsonc.parse(Fs.readFileSync(path, { encoding: "utf8" }));
    }
}
