/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import { Settings } from "../settings";
import { Workbench } from "../../iar/tools/workbench";

export interface BuildTaskDefinition {
    readonly label: string;
    readonly type: string;
    readonly command: string;
    readonly builder: string;
    readonly project: string;
    readonly config: string;
}

enum TaskNames {
    Build = "Build Project",
    Rebuild = "Rebuild Project",
    Clean = "Clean Project",
}

export namespace BuildTasks {
    export function generateTasks(dstMap: Map<string, Vscode.Task>): void {
        if (dstMap.get(TaskNames.Build) === undefined) {
            const task = generateTask(TaskNames.Build, "build");

            if (!task) {
                showErrorFailedToCreateDefaultTask(TaskNames.Build, "build");
            } else {
                dstMap.set(TaskNames.Build, task);
            }
        }

        if (dstMap.get(TaskNames.Rebuild) === undefined) {
            const task = generateTask(TaskNames.Rebuild, "rebuild");

            if (!task) {
                showErrorFailedToCreateDefaultTask(TaskNames.Rebuild, "rebuild");
            } else {
                dstMap.set(TaskNames.Rebuild, task);
            }
        }
        if (dstMap.get(TaskNames.Clean) === undefined) {
            const task = generateTask(TaskNames.Clean, "clean");

            if (!task) {
                showErrorFailedToCreateDefaultTask(TaskNames.Clean, "clean");
            } else {
                dstMap.set(TaskNames.Clean, task);
            }
        }
    }

    export function generateFromDefinition(definition: Vscode.TaskDefinition): Vscode.Task | undefined {
        const builder = definition["builder"];
        const command = definition["command"];
        const project = definition["project"];
        const config = definition["config"];
        const label = definition["label"];
        const iarCommand = convertCommandToIarCommand(command);

        if (command === undefined) {
            showErrorMissingField("command", label);
            return undefined;
        } else if (iarCommand === undefined) {
            showErrorInvalidField("command", label, command);
            return undefined;
        }

        if (builder === undefined) {
            showErrorMissingField("builder", label);
            return undefined;
        }

        if (project === undefined) {
            showErrorMissingField("project", label);
            return undefined;
        }

        if (config === undefined) {
            showErrorMissingField("config", label);
            return undefined;
        }

        if (label === undefined) {
            showErrorMissingField("label", label);
            return undefined;
        }

        let args = [
            project,
            iarCommand,
            config,
            "-log", "info" // VSC-124 This gives the same verbosity as EW
        ];

        let extraArgs = definition["extraBuildArguments"];
        if (extraArgs === undefined || extraArgs.length === 0) {
            extraArgs = Settings.getExtraBuildArguments();
        }
        if (extraArgs.length !== 0) {
            args = args.concat(extraArgs);
        }

        // Make sure to escape all arguments
        const process = new Vscode.ShellExecution(
            { value: builder, quoting: Vscode.ShellQuoting.Escape },
            args.map(arg => {
                return { value: arg, quoting: Vscode.ShellQuoting.Escape };
            }),
            {}
        );

        const task: Vscode.Task = new Vscode.Task(definition, Vscode.TaskScope.Workspace, label, "iar", process);

        if (definition["problemMatcher"] !== undefined) {
            task.problemMatchers = definition["problemMatcher"];
        }

        return task;
    }

    function generateTask(label: string, command: string): Vscode.Task | undefined {
        const iarCommand = convertCommandToIarCommand(command);

        if (iarCommand) {
            const definition = {
                label: label,
                type: "iar",
                command: command,
                builder: "${command:iar-settings.workbench}/" + Workbench.builderSubPath,
                project: "${command:iar-settings.project-file}",
                config: "${command:iar-settings.project-configuration}",
                extraBuildArguments: [],
                problemMatcher: ["$iar-cc", "$iar-linker"]
            };

            return generateFromDefinition(definition);
        } else {
            return undefined;
        }
    }

    function convertCommandToIarCommand(command: string | undefined): string | undefined {
        if (command === "build") {
            return "-make";
        } else if (command === "rebuild") {
            return "-build";
        } else if (command === "clean") {
            return "-clean";
        } else {
            return undefined;
        }
    }

    function showErrorMissingField(field: string, label: string): void {
        Vscode.window.showErrorMessage(`'${field}' is missing for task with label '${label}'.`);
    }

    function showErrorInvalidField(field: string, label: string, value: string): void {
        Vscode.window.showErrorMessage(`'${field}' has an invalid value ('${value}') for task with label '${label}'.`);
    }

    function showErrorFailedToCreateDefaultTask(label: string, command: string): void {
        Vscode.window.showErrorMessage(`Failed to create task '${label}' with command ${command}.`);
    }
}
