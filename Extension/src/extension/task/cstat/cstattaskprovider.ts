/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import { ExtensionState } from "../../extensionstate";
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
    action: "run" | "clear" | "report-full" | "report-summary";
    toolchain: string;
    project: string;
    config: string;
    extraBuildArguments: string[];
}

/**
 * Tells vs code what C-STAT tasks are available, helps resolve missing values from task definitions,
 * and defines how to start C-STAT tasks. Also handles a diagnostics collection which all C-STAT tasks
 * push their results to.
 */
class CStatProvider implements Vscode.TaskProvider {
    // shared by all cstat tasks
    private readonly diagnosticsCollection: Vscode.DiagnosticCollection;
    private readonly extensionRootPath: string;

    constructor(context: Vscode.ExtensionContext) {
        this.diagnosticsCollection = Vscode.languages.createDiagnosticCollection("C-STAT");
        this.extensionRootPath = context.extensionPath;
    }

    provideTasks(): Vscode.ProviderResult<Vscode.Task[]> {
        const tasks: Vscode.Task[] = [];
        const taskVariants: Array<[string, "run" | "clear" | "report-full" | "report-summary"]> =
            [
                ["Run C-STAT Analysis", "run"],
                ["Clear C-STAT Diagnostics", "clear"],
                ["Generate Full HTML Report", "report-full"],
                ["Generate HTML Summary", "report-summary"],
            ];
        for (const [label, action] of taskVariants) {
            const definition = this.getDefaultTaskDefinition(label, action);
            const execution = this.getExecution();
            const task = new Vscode.Task(definition, Vscode.TaskScope.Workspace, label, "iar-cstat", execution, []);
            tasks.push(task);
        }
        return tasks;
    }

    resolveTask(_task: Vscode.Task): Vscode.ProviderResult<Vscode.Task> {
        const action = _task.definition["action"];
        const label = _task.definition["label"];

        if (!action) {
            this.showErrorMissingField("action", label);
            return undefined;
        } else if (!["run", "clear", "report-full", "report-summary"].includes(action)) {
            return undefined;
        }

        if (!label) {
            this.showErrorMissingField("label", label);
            return undefined;
        }

        try {
            const execution = this.getExecution(this.getFallbackDefinition(label, action));
            return new Vscode.Task(_task.definition, Vscode.TaskScope.Workspace, _task.definition["label"], "iar-cstat", execution, []);
        } catch (e) {
            if (e instanceof Error) {
                Vscode.window.showErrorMessage(e.message);
            }
            return undefined;
        }
    }

    private getDefaultTaskDefinition(label: string, action: "run" | "clear" | "report-full" | "report-summary"): CStatTaskDefinition {
        const definition: CStatTaskDefinition = {
            label: label,
            type: "iar-cstat",
            action: action,
            toolchain: "${command:iar-settings.toolchain}",
            project: "${command:iar-settings.project-file}",
            config: "${command:iar-settings.project-configuration}",
            extraBuildArguments: [],
        };
        return definition;
    }

    // Creates a custom task execution. VS Code will provide a task definition with e.g. command variables resolved,
    // but if some properties are missing (because the user didn't specify them), we fill them in from the fallback definition.
    private getExecution(fallbackDefinition?: CStatTaskDefinition): Vscode.CustomExecution {
        return new Vscode.CustomExecution((resolvedDefinition) => {
            const definition = resolvedDefinition as CStatTaskDefinition;
            for (const property in fallbackDefinition) {
                if (!definition[property as keyof CStatTaskDefinition]) {
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    definition[property as keyof CStatTaskDefinition] = fallbackDefinition[property as keyof CStatTaskDefinition];
                }
            }
            return Promise.resolve(
                new CStatTaskExecution(this.extensionRootPath, this.diagnosticsCollection, definition)
            );
        });
    }

    // Essentially the same as above, but without the command variables. We use these values as fallbacks for when
    // a property is missing from the task definition, but we're past the stage of resolving command variables.
    private getFallbackDefinition(label: string, action: "run" | "clear" | "report-full" | "report-summary"): CStatTaskDefinition {
        const workbench = ExtensionState.getInstance().workbench.selected?.path;
        if (!workbench) {
            throw new Error("Please select a toolchain, or specify one in the task definition.");
        }
        const project = ExtensionState.getInstance().project.selected?.path;
        if (!project) {
            throw new Error("Please select a project, or specify one in the task definition.");
        }
        const config = ExtensionState.getInstance().config.selected?.name;
        if (!config) {
            throw new Error("Please select a project configuration, or specify one in the task definition.");
        }
        const definition: CStatTaskDefinition = {
            label: label,
            type: "iar-cstat",
            action: action,
            toolchain: workbench.toString(),
            project: project.toString(),
            config: config,
            extraBuildArguments: [],
        };
        return definition;
    }


    private showErrorMissingField(field: string, label: string): void {
        Vscode.window.showErrorMessage(`'${field}' is missing for task with label '${label}'.`);
    }
}
