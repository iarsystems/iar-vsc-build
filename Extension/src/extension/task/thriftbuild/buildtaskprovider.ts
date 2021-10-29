/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import { BuildTaskExecution } from "./buildtaskexecution";

// TODO: make this generic enough to work with any task execution (i.e. "regular" or custom/thrift).
export namespace BuildTaskProvider {
    let taskProvider: Vscode.Disposable | undefined = undefined;

    export function register() {
        if (!taskProvider) {
            taskProvider = Vscode.tasks.registerTaskProvider("iar-thrift", new BuildProvider());
        }
    }

    export function unRegister() {
        if (taskProvider) {
            taskProvider.dispose();
            taskProvider = undefined;
        }
    }
}

export interface BuildTaskDefinition {
    label: string;
    type: string;
    config: string;
}

class BuildProvider implements Vscode.TaskProvider {

    provideTasks(): Vscode.ProviderResult<Vscode.Task[]> {
        const tasks: Vscode.Task[] = [];
        const defaultLabel = "Iar Build (thrift)";
        const definition = this.getDefaultTaskDefinition(defaultLabel);
        const execution = this.executionFromDefinition(definition);
        const task = new Vscode.Task(definition, Vscode.TaskScope.Workspace, defaultLabel, "iar-thrift", execution);
        tasks.push(task);
        return tasks;
    }

    resolveTask(_task: Vscode.Task): Vscode.ProviderResult<Vscode.Task> {
        const label = _task.definition.label;

        if (!label) {
            this.showErrorMissingField("label", label);
            return undefined;
        }

        // Fill in missing properties with their default values.
        // I don't think there is a better way than using 'any', this should be type-safe anyway
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fullDefinition: any = this.getDefaultTaskDefinition(_task.definition.label);
        for (const property in fullDefinition) {
            if (_task.definition[property]) {
                fullDefinition[property] = _task.definition[property];
            }
        }

        const execution = this.executionFromDefinition(fullDefinition);
        return new Vscode.Task(_task.definition, Vscode.TaskScope.Workspace, _task.definition.label, "iar-thrift", execution);
    }

    private getDefaultTaskDefinition(label: string): BuildTaskDefinition {
        const definition: BuildTaskDefinition = {
            label: label,
            type: "iar-thrift",
            config: "${command:iar-settings.project-configuration}",
        };
        return definition;
    }

    private executionFromDefinition(definition: BuildTaskDefinition): Vscode.CustomExecution {
        return new Vscode.CustomExecution(() => {
            return Promise.resolve(new BuildTaskExecution(definition));
        });
    }

    private showErrorMissingField(field: string, label: string): void {
        Vscode.window.showErrorMessage(`'${field}' is missing for task with label '${label}'.`);
    }
}
