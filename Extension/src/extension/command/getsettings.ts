/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";

import { Command } from "./command"
import { Settings } from "../settings"

export enum GetSettingsCommand {
    Workbench = "iar-settings.workbench",
    Compiler = "iar-settings.compiler",
    ProjectFile = "iar-settings.project-file",
    ProjectConfiguration = "iar-settings.project-configuration"
}

class GetSettings implements Command {
    private settingsCallback: () => any;

    command: string;
    enabled: boolean;

    constructor(command: GetSettingsCommand, getSettingsCallback: () => any) {
        this.command = command;
        this.enabled = true;
        this.settingsCallback = getSettingsCallback;
    }

    execute(): any {
        let value = this.settingsCallback();

        if (value !== undefined) {
            return value.toString();
        } else {
            return undefined;
        }
    }

    register(context: Vscode.ExtensionContext): void {
        let cmd = Vscode.commands.registerCommand(this.command, (): any => {
            return this.execute();
        }, this);

        context.subscriptions.push(cmd);
    }
}

export namespace GetSettingsCommand {
    export function initCommands(context: Vscode.ExtensionContext): void {
        initCommand(context, GetSettingsCommand.Workbench, Settings.getWorkbench);
        initCommand(context, GetSettingsCommand.Compiler, Settings.getCompiler);
        initCommand(context, GetSettingsCommand.ProjectFile, Settings.getEwpFile);
        initCommand(context, GetSettingsCommand.ProjectConfiguration, Settings.getConfiguration);
    }

    function initCommand(context: Vscode.ExtensionContext, command: GetSettingsCommand, getSettingsCallback: () => any): void {
        let cmd = new GetSettings(command, getSettingsCallback);
        cmd.register(context);

        Command.getCommandManager().add(cmd);
    }
}
