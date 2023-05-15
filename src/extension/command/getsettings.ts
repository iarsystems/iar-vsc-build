/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";

import { Command } from "./command";
import { Settings } from "../settings";
import { ExtensionState } from "../extensionstate";

export enum GetSettingsCommand {
    Workbench = "iar-config.toolchain",
    WorkspaceFile = "iar-config.workspace-file",
    ProjectFile = "iar-config.project-file",
    ProjectConfiguration = "iar-config.project-configuration",
    ProjectName = "iar-config.project-name",
    ArgVarFile = "iar-config.argument-variables-file",
}

class GetSettings implements Command<string> {

    constructor(readonly id: GetSettingsCommand, private readonly field: Settings.LocalSettingsField) {
    }

    execute(_autoTriggered: boolean): string {
        // We should not return undefined here. These commands are used as variables in e.g. tasks, and returning
        // undefined from a command variable will make the task fail silently.
        return Settings.getLocalSetting(this.field) ?? "";
    }

    register(context: Vscode.ExtensionContext): void {
        const cmd = Vscode.commands.registerCommand(this.id, (): string => {
            return this.execute(false);
        }, this);

        context.subscriptions.push(cmd);
    }
}

class GetProjectName implements Command<string | undefined> {

    constructor(readonly id: GetSettingsCommand) {
    }

    execute(_autoTriggered: boolean): string | undefined {
        return ExtensionState.getInstance().project.selected?.name;
    }

    register(context: Vscode.ExtensionContext): void {
        const cmd = Vscode.commands.registerCommand(this.id, (): string | undefined => {
            return this.execute(false);
        }, this);

        context.subscriptions.push(cmd);
    }
}

class GetArgVarFile implements Command<string> {

    constructor(readonly id: GetSettingsCommand) {
    }

    execute(_autoTriggered: boolean): string {
        // We should not return undefined here. This command is used as a variable in e.g. tasks, and returning
        // undefined from a command variable will make the task fail silently.
        return ExtensionState.getInstance().workspace.selected?.getArgvarsFile() ?? "";
    }

    register(context: Vscode.ExtensionContext): void {
        const cmd = Vscode.commands.registerCommand(this.id, (): string | undefined => {
            return this.execute(false);
        }, this);

        context.subscriptions.push(cmd);
    }
}

export namespace GetSettingsCommand {
    export function initCommands(context: Vscode.ExtensionContext): void {
        initCommand(context, GetSettingsCommand.Workbench, Settings.LocalSettingsField.Workbench);
        initCommand(context, GetSettingsCommand.WorkspaceFile, Settings.LocalSettingsField.Workspace);
        initCommand(context, GetSettingsCommand.ProjectFile, Settings.LocalSettingsField.Ewp);
        initCommand(context, GetSettingsCommand.ProjectConfiguration, Settings.LocalSettingsField.Configuration);
        const projectNameCmd = new GetProjectName(GetSettingsCommand.ProjectName);
        projectNameCmd.register(context);
        const argVarCmd = new GetArgVarFile(GetSettingsCommand.ArgVarFile);
        argVarCmd.register(context);
    }

    function initCommand(context: Vscode.ExtensionContext, command: GetSettingsCommand, field: Settings.LocalSettingsField): void {
        const cmd = new GetSettings(command, field);
        cmd.register(context);
    }
}
