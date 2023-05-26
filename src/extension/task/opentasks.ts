/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import { OsUtils } from "iar-vsc-common/osUtils";
import { Workbench } from "iar-vsc-common/workbench";


export namespace OpenTasks {
    export const OPEN_TASK_NAME = "Open Workspace in IAR Embedded Workbench";
    export function generateTasks(dstMap: Map<string, Vscode.Task>): void {
        if (OsUtils.detectOsType() !== OsUtils.OsType.Windows) {
            return; // VSC-216 We don't have a linux workbech GUI
        }

        if (dstMap.get(OPEN_TASK_NAME) === undefined) {
            const task = generateTask(OPEN_TASK_NAME);

            if (!task) {
                showErrorFailedToCreateDefaultTask(OPEN_TASK_NAME, "open");
            } else {
                dstMap.set(OPEN_TASK_NAME, task);
            }
        }
    }

    export function generateFromDefinition(definition: Vscode.TaskDefinition): Vscode.Task | undefined {
        if (OsUtils.detectOsType() !== OsUtils.OsType.Windows) {
            Vscode.window.showErrorMessage("Opening a workspace is only supported on windows.");
            return; // VSC-216 We don't have a linux workbech GUI
        }

        const command = definition["command"];
        const workspace = definition["workspace"];
        const label = definition["label"];
        const workbench = definition["workbench"];

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

        // Make sure to escape all arguments
        const process = new Vscode.ShellExecution(
            { value: workbench, quoting: Vscode.ShellQuoting.Strong },
            [
                { value: workspace, quoting: Vscode.ShellQuoting.Strong }
            ],
            {}
        );

        const task: Vscode.Task = new Vscode.Task(definition, Vscode.TaskScope.Workspace, label, "iar", process);

        if (definition["problemMatcher"] !== undefined) {
            task.problemMatchers = definition["problemMatcher"];
        }
        return task;
    }

    function generateTask(label: string): Vscode.Task | undefined {
        const definition = {
            label: label,
            type: "iar",
            command: "open",
            workbench: "${command:iar-config.toolchain}/" + Workbench.ideSubPath,
            workspace: "${command:iar-config.workspace-file}",
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
