/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";

import { Command } from "./command";
import { Settings } from "../settings";

export enum GetSettingsCommand {
    Workbench = "iar-config.toolchain",
    ProjectFile = "iar-config.project-file",
    ProjectConfiguration = "iar-config.project-configuration"
}

class GetSettings implements Command<string | undefined> {

    constructor(readonly id: GetSettingsCommand, private readonly field: Settings.LocalSettingsField) {
    }

    execute(_autoTriggered: boolean): string | undefined {
        return Settings.getLocalSetting(this.field);
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
        initCommand(context, GetSettingsCommand.ProjectFile, Settings.LocalSettingsField.Ewp);
        initCommand(context, GetSettingsCommand.ProjectConfiguration, Settings.LocalSettingsField.Configuration);
    }

    function initCommand(context: Vscode.ExtensionContext, command: GetSettingsCommand, field: Settings.LocalSettingsField): void {
        const cmd = new GetSettings(command, field);
        cmd.register(context);
    }
}
