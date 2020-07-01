/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import { Command } from "../manager";
import { UI } from "../../ui/app";
import * as Path from "path";
import * as Fs from "fs";

/**
 * Prompts the user for a name and creates a new project using the currently selected workbench
 */
export class CreateProjectCommand implements Command {

    readonly command: string = "iar.createProject";
    enabled: boolean = true;

    canExecute(): boolean {
        return true;
    }

    register(context: Vscode.ExtensionContext): void {
        let cmd = Vscode.commands.registerCommand(this.command, (): any => {
            return this.execute(false);
        }, this);

        context.subscriptions.push(cmd);
    }

    async execute(_autoTriggered?: boolean | undefined) {
        try {
            const workbench = UI.getInstance().workbench.model.selected;
            if (!workbench) {
                Vscode.window.showErrorMessage("You must select a workbench before creating a project.");
                return;
            }
            const pm = UI.getInstance().projectManager;
            // TODO: check if the project manager is still starting (e.g. because the extension was just activated by this command).
            if (!pm) {
                Vscode.window.showErrorMessage("The selected workbench appears to old. Select a newer one or create the project inside the workbench.");
                return;
            }
            let name = await Vscode.window.showInputBox({
                                                            prompt: `Enter a name for the new project. The project will be created using '${workbench.name}'.`,
                                                            placeHolder: "my_project" });
            if (!name) { return; }
            if (!name.endsWith(".ewp")) {
                name = name + ".ewp";
            }
            const workspace = await this.getWorkspace();
            if (!workspace) {
                return;
            }

            const path = Path.join(workspace.uri.fsPath, name);
            if (Fs.existsSync(path)) {
                throw "The file already exists."
            }

            await pm.service.CreateEwpFile(path); // TODO: does the PM auto-load the project? In that case it should be unloaded here
            // TODO: notify Model<Project> of this change?

            Vscode.window.showInformationMessage(`The project has been created as ${name}.`);
        } catch(e) {
            Vscode.window.showErrorMessage("Unable to create project: " + e.toString());
        }
    }

    private async getWorkspace(): Promise<Vscode.WorkspaceFolder | undefined> {
        const workspaces = Vscode.workspace.workspaceFolders;
        if (!workspaces || workspaces.length === 0) {
            return Promise.reject("No VS Code workspace opened.");
        } else if (workspaces.length === 1) {
            return Promise.resolve(workspaces[0]);
        } else {
            return await Vscode.window.showWorkspaceFolderPick({ placeHolder: "Where to create the project?" });
        }
    }
}