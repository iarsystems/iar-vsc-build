/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import * as Path from "path";

import { Command } from "./command";
import { FsUtils } from "../../utils/fs";

export class SelectIarWorkspace implements Command {
    command: string;
    enabled: boolean;

    constructor() {
        this.command = "iar.selectIarWorkspace";
        this.enabled = true;
    }

    execute(): any {
        if (Vscode.workspace.rootPath) {
            let workspaceFolder = Vscode.workspace.rootPath;

            let filter = FsUtils.createFilteredListDirectoryFilenameRegex(/\.*\.eww/);
            let files = FsUtils.walkAndFind(workspaceFolder, true, filter);

            let workspacePaths: string[] = [];

            files.forEach(file => {
                let relativePath = Path.relative(workspaceFolder.toString(), file.toString());
                workspacePaths.push(relativePath);
            });

            if (workspacePaths.length > 1) {
                return Vscode.window.showQuickPick(workspacePaths);
            } else if (workspacePaths.length === 1) {
                return workspacePaths[0];
            } else {
                Vscode.window.showErrorMessage("No IAR Workspaces found.");
                return undefined;
            }
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
