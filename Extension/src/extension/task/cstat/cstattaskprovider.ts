/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import { OsUtils } from "../../../utils/utils";
import { CStatTaskExecution } from "./cstattaskexecution";

export namespace CStatTaskProvider {
    let taskProvider: Vscode.Disposable | undefined = undefined;

    export function register(context: Vscode.ExtensionContext) {
        if (!taskProvider) {
            taskProvider = Vscode.tasks.registerTaskProvider("iar-cstat", new CStatProvider(context));
        }
    }

    export function unRegister() {
        if (taskProvider) {
            taskProvider.dispose();
            taskProvider = undefined;
        }
    }
}

export interface CStatTaskDefinition {
    label: string;
    type: string;
    action: "run" | "clear";
    builder: string;
    project: string;
    config: string;
}

class CStatProvider implements Vscode.TaskProvider {
    // shared by all cstat tasks
    private diagnosticsCollection: Vscode.DiagnosticCollection;
    private extensionRootPath: string;

    constructor(context: Vscode.ExtensionContext) {
        this.diagnosticsCollection = Vscode.languages.createDiagnosticCollection("C-STAT");
        this.extensionRootPath = context.extensionPath;
    }

    provideTasks(): Vscode.ProviderResult<Vscode.Task[]> {
        const tasks: Vscode.Task[] = [];
        if (OsUtils.OsType.Windows !== OsUtils.detectOsType()) {
            return []; // We can only perform cstat tasks on Windows
        }
        const taskVariants: Array<[string, "run" | "clear"]> =
            [["Run C-STAT Analysis", "run"],
            ["Clear C-STAT Diagnostics", "clear"]];
        for (const [label, action] of taskVariants) {
            const definition = this.getDefaultTaskDefinition(label, action);
            let execution = this.executionFromDefinition(definition);
            let task = new Vscode.Task(definition, Vscode.TaskScope.Workspace, label, "iar-cstat", execution, []);
            tasks.push(task);
        }
        return tasks;
    }

    resolveTask(_task: Vscode.Task): Vscode.ProviderResult<Vscode.Task> {
        let action = _task.definition.action;
        let label = _task.definition.label;

        if (!action) {
            this.showErrorMissingField("action", label);
            return undefined;
        } else if (action !== "run" && action !== "clear") {
            return undefined;
        }

        if (!label) {
            this.showErrorMissingField("label", label);
            return undefined;
        }

        // fill in missing properties with their default values
        const fullDefinition: any = this.getDefaultTaskDefinition(_task.definition.label, _task.definition.action);
        for (const property in fullDefinition) {
            if (_task.definition[property]) {
                fullDefinition[property] = _task.definition[property];
            }
        }

        let execution = this.executionFromDefinition(fullDefinition);
        return new Vscode.Task(_task.definition, Vscode.TaskScope.Workspace, _task.definition.label, "iar-cstat", execution, []);
    }

    private getDefaultTaskDefinition(label: string, action: "run" | "clear"): CStatTaskDefinition {
        const definition: CStatTaskDefinition = {
            label: label,
            type: "iar-cstat",
            action: action,
            builder: "${command:iar-settings.workbench}/common/bin/IarBuild" + (OsUtils.detectOsType() === OsUtils.OsType.Windows ? ".exe" : ""),
            project: "${command:iar-settings.project-file}",
            config: "${command:iar-settings.project-configuration}",
        };
        return definition;
    }

    private executionFromDefinition(definition: CStatTaskDefinition): Vscode.CustomExecution {
        return new Vscode.CustomExecution(async () => {
            return new CStatTaskExecution(this.extensionRootPath, this.diagnosticsCollection, definition);
        });
    }

    private showErrorMissingField(field: string, label: string): void {
        Vscode.window.showErrorMessage(`'${field}' is missing for task with label '${label}'.`);
    }
}
