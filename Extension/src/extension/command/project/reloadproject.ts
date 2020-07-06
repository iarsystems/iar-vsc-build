/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import { Command } from "../manager";
import { UI } from "../../ui/app";

export class ReloadProjectCommand implements Command {

    readonly command = "iar.reloadProject";
    readonly enabled: boolean = true;

    canExecute(): boolean {
        return true;
    }

    register(context: Vscode.ExtensionContext): void {
        let cmd = Vscode.commands.registerCommand(this.command, (): any => {
            return this.execute(false);
        }, this);

        context.subscriptions.push(cmd);
    }

    async execute(_autoTriggered?: boolean) {
        const project = UI.getInstance().loadedProject.selected;
        if (!project) {
            Vscode.window.showErrorMessage("IAR: No project is loaded.");
            return;
        }
        await project.reload();
        Vscode.window.showInformationMessage("IAR: Project reloaded.");
    }
} 