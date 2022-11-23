/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import { Workbench } from "iar-vsc-common/workbench";
import { BuildTaskExecution } from "./buildtaskexecution";

export interface BuildTaskDefinition {
    readonly label: string;
    readonly type: string;
    readonly command: string;
    readonly builder: string;
    readonly project: string;
    readonly config: string;
    readonly argumentVariablesFile: string | undefined;
    readonly extraBuildArguments: string[] | undefined;
}


export namespace BuildTasks {
    export enum TaskNames {
        Build = "Build Project",
        Rebuild = "Rebuild Project",
        Clean = "Clean Project",
    }

    export function generateTasks(dstMap: Map<string, Vscode.Task>): void {
        if (dstMap.get(TaskNames.Build) === undefined) {
            const task = generateTask(TaskNames.Build, "build");
            dstMap.set(TaskNames.Build, task);
        }

        if (dstMap.get(TaskNames.Rebuild) === undefined) {
            const task = generateTask(TaskNames.Rebuild, "rebuild");
            dstMap.set(TaskNames.Rebuild, task);
        }
        if (dstMap.get(TaskNames.Clean) === undefined) {
            const task = generateTask(TaskNames.Clean, "clean");
            dstMap.set(TaskNames.Clean, task);
        }
    }

    export function generateFromDefinition(definition: Vscode.TaskDefinition): Vscode.Task | undefined {
        const label = definition["label"];

        if (label === undefined) {
            Vscode.window.showErrorMessage("IAR: Unable to resolve task, it is missing a label.");
            return undefined;
        }

        const task = new Vscode.Task(definition, Vscode.TaskScope.Workspace, label, "iar", getExecution(), ["$iar-cc", "$iar-linker"]);
        if (definition["problemMatcher"] !== undefined) {
            task.problemMatchers = definition["problemMatcher"];
        }

        return task;
    }

    function generateTask(label: string, command: string) {
        const definition = {
            label: label,
            type: "iar",
            command: command,
            builder: "${command:iar-config.toolchain}/" + Workbench.builderSubPath,
            project: "${command:iar-config.project-file}",
            config: "${command:iar-config.project-configuration}",
            argumentVariablesFile:  "${command:iar-config.argument-variables-file}",
            extraBuildArguments: undefined,
            problemMatcher: ["$iar-cc", "$iar-linker"]
        };

        return new Vscode.Task(definition, Vscode.TaskScope.Workspace, label, "iar", getExecution(), ["$iar-cc", "$iar-linker"]);
    }

    // Creates a custom task execution. VS Code will provide a task definition with e.g. command variables resolved
    function getExecution(): Vscode.CustomExecution {
        return new Vscode.CustomExecution(resolvedDefinition => {
            return Promise.resolve(
                new BuildTaskExecution(resolvedDefinition)
            );
        });
    }
}
