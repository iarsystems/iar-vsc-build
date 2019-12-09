/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import { isArray } from "util";
import { Settings } from "../settings";
import { IarExecution } from "./iarexecution";
import { OsUtils } from "../../utils/utils";

export interface BuildTaskDefinition {
    readonly label: string;
    readonly type: string;
    readonly command: string;
    readonly builder: string;
    readonly project: string;
    readonly config: string;
}

export namespace BuildTasks {
    export function generateTasks(dstMap: Map<string, Vscode.Task>): void {
        if (dstMap.get("Iar Build") === undefined) {
            let task = generateTask("Iar Build", "build");

            if (!task) {
                showErrorFailedToCreateDefaultTask("Iar Build", "build");
            } else {
                dstMap.set("Iar Build", task);
            }
        }

        if (dstMap.get("Iar Rebuild") === undefined) {
            let task = generateTask("Iar Rebuild", "rebuild");

            if (!task) {
                showErrorFailedToCreateDefaultTask("Iar Rebuild", "rebuild");
            } else {
                dstMap.set("Iar Rebuild", task);
            }
        }
    }

    export function generateFromDefinition(definition: Vscode.TaskDefinition): Vscode.Task | undefined {
        let builder = definition["builder"];
        let command = definition["command"];
        let project = definition["project"];
        let config = definition["config"];
        let label = definition["label"];
        let iarCommand = convertCommandToIarCommand(command);

        if (command === undefined) {
            showErrorMissingField("command", label);
            return undefined;
        } else if (iarCommand === undefined) {
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
            config
        ];

        let extraArgs = Settings.getExtraBuildArguments();
        if (extraArgs.length !== 0) {
            args = args.concat(extraArgs);
        }

        if (iarCommand) {
            let process = new IarExecution(
                builder,
                args
            );

            let task: Vscode.Task = new Vscode.Task(definition, Vscode.TaskScope.Workspace, label, "iar", process);

            if (definition["problemMatcher"] !== undefined) {
                task.problemMatchers = definition["problemMatcher"];
            }

            return task;
        } else {
            return undefined;
        }
    }

    export function generateFromTasksJson(json: any, dst: Map<string, Vscode.Task>): void {
        let tasks: any = json["tasks"];
        let tasksAsArray: Array<any>;

        if ((tasks === undefined) || !isArray(tasks)) {
            return;
        } else {
            tasksAsArray = tasks as Array<any>;
        }

        tasksAsArray.forEach(taskDefinition => {
            let task = generateFromDefinition(taskDefinition);

            if (task) {
                dst.set(taskDefinition["label"], task);
            }
        });
    }

    function generateTask(label: string, command: string): Vscode.Task | undefined {
        let iarCommand = convertCommandToIarCommand(command);

        if (iarCommand) {
            let definition = {
                label: label,
                type: "iar",
                command: command,
                builder: "${command:iar-settings.workbench}/common/bin/IarBuild" + (OsUtils.detectOsType() == OsUtils.OsType.Windows ? ".exe" : ""),
                project: "${command:iar-settings.project-file}",
                config: "${command:iar-settings.project-configuration}",
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
        } else {
            return undefined;
        }
    }

    function showErrorMissingField(field: string, label: string): void {
        Vscode.window.showErrorMessage(`'${field}' is missing for task with label '${label}'.`);
    }

    function showErrorFailedToCreateDefaultTask(label: string, command: string): void {
        Vscode.window.showErrorMessage(`Failed to create task '${label}' with command ${command}.`);
    }
}
