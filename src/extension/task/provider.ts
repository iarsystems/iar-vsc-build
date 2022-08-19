/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { OsUtils } from "iar-vsc-common/osUtils";
import * as Vscode from "vscode";

import { BuildTasks } from "./buildtasks";
import { OpenTasks } from "./opentasks";

export namespace IarTaskProvider {
    let tasks: Vscode.Task[] = [];
    let taskProvider: Vscode.Disposable | undefined = undefined;
    let linkProvider: Vscode.Disposable | undefined = undefined;

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
        // VSC-305 VS Code doesn't understand iarbuild's file path/line number format.
        // To make file paths ctrl-clickable, we must register our own link provider.
        if (!linkProvider) {
            type FileLink = Vscode.TerminalLink & { uri: Vscode.Uri };

            const provider: Vscode.TerminalLinkProvider<FileLink> = {
                provideTerminalLinks(context, _token): FileLink[] {
                    // Detect source file paths with line numbers (e.g. /my/file.c(15))
                    const fileRegex = OsUtils.detectOsType() === OsUtils.OsType.Windows ?
                        /(?<!\w)([a-zA-Z]:(?:[\\/][\w .!#()-]+)+)\((\d+)\)/g :
                        /(?<!\w)((?:\/[\w .!#()-]+)+)\((\d+)\)/g;
                    const execResult = fileRegex.exec(context.line);
                    if (execResult && execResult[0] && execResult[1] && execResult[2]) {
                        return [{
                            startIndex: execResult.index,
                            length: execResult[0].length,
                            uri: Vscode.Uri.file(execResult[1]).with({fragment: "L" + execResult[2]}),
                        }];
                    }
                    // Detect file paths in the iarbuild command line we print at the top of the task output
                    // (e.g. to iarbuild or the .ewp file). VS Code can detect these file paths on its own, but doesn't
                    // handle spaces in the file paths (see https://github.com/IARSystems/iar-vsc-build/issues/16).
                    if (context.line.startsWith(">")) {
                        const fileRegex = OsUtils.detectOsType() === OsUtils.OsType.Windows ?
                            /(?<=')[a-zA-Z]:(?:(?:\\\\|\\|\/)[\w .!#()-]+)+(?=')/g :
                            /(?<=')(?:\/[\w .!#()-]+)+(?=')/g;
                        const matches = context.line.matchAll(fileRegex);
                        const foundLinks: FileLink[] = [];
                        for (const match of matches) {
                            if (match[0] === undefined || match.index === undefined) {
                                continue;
                            }
                            foundLinks.push({
                                startIndex: match.index,
                                length: match[0].length,
                                uri: Vscode.Uri.file(match[0].replace(/\\\\/g, "\\")),
                            });
                        }
                        return foundLinks;
                    }
                    return [];
                },
                handleTerminalLink(link: FileLink) {
                    Vscode.commands.executeCommand("vscode.open", link.uri);
                },
            };
            linkProvider = Vscode.window.registerTerminalLinkProvider(provider);
        }
    }

    export function unregister(): void {
        if (taskProvider) {
            taskProvider.dispose();
            taskProvider = undefined;
        }
        if (linkProvider) {
            linkProvider.dispose();
            linkProvider = undefined;
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
