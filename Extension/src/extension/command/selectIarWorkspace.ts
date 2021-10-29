/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import * as Path from "path";

import { CommandBase } from "./command";
import { FsUtils } from "../../utils/fs";
import { ThenableToPromise } from "../../utils/promise";

/**
 * Opens a dialog where the user can select an EW workspace (.eww) file from the opened VS Code workspace
 */
export class SelectIarWorkspace extends CommandBase<Promise<string | undefined>> {

    constructor() {
        super("iar.selectIarWorkspace");
    }

    executeImpl(_autoTriggered: boolean): Promise<string | undefined> {
        // TODO: support multi-root workspaces
        if (Vscode.workspace.rootPath) {
            const workspaceFolder = Vscode.workspace.rootPath;

            const filter = FsUtils.createFilteredListDirectoryFilenameRegex(/\.*\.eww/);
            const files = FsUtils.walkAndFind(workspaceFolder, true, filter);

            const workspacePaths: string[] = [];

            files.forEach(file => {
                const relativePath = Path.relative(workspaceFolder.toString(), file.toString());
                workspacePaths.push(relativePath);
            });

            if (workspacePaths.length > 1) {
                return ThenableToPromise(Vscode.window.showQuickPick(workspacePaths));
            } else if (workspacePaths.length === 1) {
                return Promise.resolve(workspacePaths[0]);
            } else {
                Vscode.window.showErrorMessage("No IAR Workspaces found.");
                return Promise.resolve(undefined);
            }
        } else {
            return Promise.resolve(undefined);
        }
    }
}
