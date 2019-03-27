/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import { isArray } from "util";

export interface OpenTaskDefinition {
    readonly label: string;
    readonly type: string;
    readonly command: string;
    readonly workbench: string;
    readonly workspace: string;
}

export namespace OpenTasks {
    export function generateTasks(dstMap: Map<string, Vscode.Task>): void {
        if (dstMap.get("Iar Open") === undefined) {
            let task = generateTask("Iar Open");

            if (!task) {
                showErrorFailedToCreateDefaultTask("Iar Open", "open");
            } else {
                dstMap.set("Iar Open", task);
            }
        }
    }

    export function generateFromDefinition(definition: Vscode.TaskDefinition): Vscode.Task | undefined {
        let command = definition["command"];
        let workspace = definition["workspace"];
        let label = definition["label"];
        let workbench = definition["workbench"];

        if (command === undefined) {
            showErrorMissingField("command", label);
            return undefined;
        } else if (command !== "open") {
            return undefined;
        }

        if (workspace === undefined) {
            showErrorMissingField("workspace", label);
            return undefined;
        }

        if (label === undefined) {
            showErrorMissingField("label", label);
            return undefined;
        }

        if (workbench === undefined) {
            showErrorMissingField("workbench", label);
            return undefined;
        }

        let process = new Vscode.ProcessExecution(
            workbench,
            [
                workspace
            ]
        );

        let task: Vscode.Task = new Vscode.Task(definition, Vscode.TaskScope.Workspace, label, "iar", process);

        if (definition["problemMatcher"] !== undefined) {
            task.problemMatchers = definition["problemMatcher"];
        }
        return task;
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

    function generateTask(label: string): Vscode.Task | undefined {
        let definition = {
            label: label,
            type: "iar",
            command: "open",
            workbench: "${config:iarvsc.workbench}\\\\common\\\\bin\\\\IarIdePm.exe",
            workspace: "${command:iar.selectIarWorkspace}",
            problemMatcher: []
        };

        return generateFromDefinition(definition);
    }

    function showErrorMissingField(field: string, label: string): void {
        Vscode.window.showErrorMessage(`'${field}' is missing for task with label '${label}'.`);
    }

    function showErrorFailedToCreateDefaultTask(label: string, command: string): void {
        Vscode.window.showErrorMessage(`Failed to create task '${label}' with command ${command}.`);
    }
}
