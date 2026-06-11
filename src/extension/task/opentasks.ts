/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import { IarOsUtils, OsUtils } from "iar-vsc-common/osUtils";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";


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
        const label = definition["label"];

        if (command === undefined) {
            showErrorMissingField("command", label);
            return undefined;
        } else if (command !== "open") {
            return undefined;
        }

        if (label === undefined) {
            showErrorMissingField("label", label);
            return undefined;
        }

        const execution = new Vscode.CustomExecution(resolvedDefinition => {
            return Promise.resolve(new OpenTaskExecution(resolvedDefinition));
        });
        const task: Vscode.Task = new Vscode.Task(definition, Vscode.TaskScope.Workspace, label, "iar", execution);

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
            workbench: "${command:iar-config.toolchain}",
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

/**
 * VSC-464: We need a custom task execution to ensure that the task exits
 * immediately after starting the workbench, without waiting for the workbench
 * to close. Otherwise, this is dependent on the shell (seems to work in
 * powershell, but not in cmd).
 */
export class OpenTaskExecution implements Vscode.Pseudoterminal {
    private readonly writeEmitter = new Vscode.EventEmitter<string>();
    onDidWrite: Vscode.Event<string> = this.writeEmitter.event;
    private readonly closeEmitter = new Vscode.EventEmitter<number>();
    onDidClose: Vscode.Event<number> = this.closeEmitter.event;

    /**
     * @param definition The task definition to execute
     */
    constructor(private readonly definition: Vscode.TaskDefinition) {
    }

    open() {
        const workbench = this.definition["workbench"];
        if (workbench === undefined) {
            this.onError("No Embedded Workbench path was specificed. Select a toolchain in the extension configuration, or configure the task manually.");
            return;
        }
        const ideExe = this.resolveIdeExecutable(workbench);
        if (typeof(ideExe) !== "string") {
            this.onError(ideExe.error);
            return;
        }

        const workspace = this.definition["workspace"];
        if (workspace === undefined) {
            this.onError("No workspace path was specificed. Select a toolchain in the extension configuration, or configure the task manually.");
            return;
        }

        this.writeEmitter.fire(`> '${ideExe}' '${workspace}'\r\n`);
        // Note the 'detached'. We spawn the workbench and forget about it.
        spawn(ideExe, [workspace], { shell: false, detached: true });
        this.closeEmitter.fire(0);
    }

    close(): void {
        // Nothing to do
    }

    // Resolves the user-provided 'workbench' field to an IDE executable
    private resolveIdeExecutable(workbenchPath: string): string | { error: string } {
        if (!fs.existsSync(workbenchPath)) {
            return { error: `'${workbenchPath}' does not exist.` };
        }

        const statRes = fs.statSync(workbenchPath);
        if (statRes.isFile()) {
            // Allow specifying an executable directly
            return workbenchPath;
        }
        if (statRes.isDirectory()) {
            const candidates = [
                path.join(workbenchPath, "iaride" + IarOsUtils.executableExtension()),
                path.join(workbenchPath, "IarIdePm" + IarOsUtils.executableExtension()),
                path.join(workbenchPath, "common/bin/iaride" + IarOsUtils.executableExtension()),
                path.join(workbenchPath, "common/bin/IarIdePm" + IarOsUtils.executableExtension()),
            ];
            const found = candidates.find(c => fs.existsSync(c));
            return found ?? { error: "Found no IDE in the specified installation. Check that the path is correct and that it is not a Build Tools installation." };
        }
        return { error: "Workbench path is not a file or directory."};
    }

    private onError(reason: string | Error) {
        this.writeEmitter.fire(reason + "\r\n");
        this.closeEmitter.fire(1);
    }
}
