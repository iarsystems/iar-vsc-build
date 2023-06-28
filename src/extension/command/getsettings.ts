/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";

import { Command } from "./command";
import { ExtensionState } from "../extensionstate";
import { InputModel } from "../model/model";
import { EwWorkspace } from "../../iar/workspace/ewworkspace";

export enum GetSettingsCommand {
    Workbench = "iar-config.toolchain",
    WorkspaceFile = "iar-config.workspace-file",
    ProjectFile = "iar-config.project-file",
    ProjectConfiguration = "iar-config.project-configuration",
    ProjectName = "iar-config.project-name",
    ArgVarFile = "iar-config.argument-variables-file",
}

class GetSettings<T> implements Command<string> {

    constructor(
        readonly id: GetSettingsCommand,
        private readonly model: InputModel<T>,
        private readonly stringify: (item: T) => string | undefined
    ) { }

    execute(_autoTriggered: boolean): string {
        // We should not return undefined here. These commands are used as variables in e.g. tasks, and returning
        // undefined from a command variable will make the task fail silently.
        return this.model.selected ?
            (this.stringify(this.model.selected) ?? "") :
            "";
    }

    register(context: Vscode.ExtensionContext): void {
        const cmd = Vscode.commands.registerCommand(this.id, (): string => {
            return this.execute(false);
        }, this);

        context.subscriptions.push(cmd);
    }
}

export namespace GetSettingsCommand {
    export function initCommands(context: Vscode.ExtensionContext): void {
        initCommand(context, GetSettingsCommand.Workbench,
            ExtensionState.getInstance().workbench, workbench => workbench.path);
        initCommand(context, GetSettingsCommand.WorkspaceFile,
            ExtensionState.getInstance().workspace, workspace => workspace.path);
        initCommand(context, GetSettingsCommand.ProjectFile,
            ExtensionState.getInstance().project, project => project.path);
        initCommand(context, GetSettingsCommand.ProjectConfiguration,
            ExtensionState.getInstance().config, config => config.name);
        initCommand(context, GetSettingsCommand.ProjectName,
            ExtensionState.getInstance().project, project => project.name);
        initCommand(context, GetSettingsCommand.ArgVarFile,
            ExtensionState.getInstance().workspace, workspace => EwWorkspace.findArgvarsFileFor(workspace));
    }

    function initCommand<T>(
        context: Vscode.ExtensionContext,
        command: GetSettingsCommand,
        model: InputModel<T>,
        stringify: (item: T) => string | undefined,
    ): void {
        const cmd = new GetSettings(command, model, stringify);
        cmd.register(context);
    }
}
