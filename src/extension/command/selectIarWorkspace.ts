/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import * as Path from "path";

import { CommandBase } from "./command";
import { ThenableToPromise } from "../../utils/promise";

/**
 * Opens a dialog where the user can select an EW workspace (.eww) file from the opened VS Code workspace
 */
export class SelectIarWorkspace extends CommandBase<Promise<string | undefined>> {

    constructor() {
        super("iar-build.selectIarWorkspace");
    }

    async executeImpl(_autoTriggered: boolean): Promise<string | undefined> {
        if (Vscode.workspace.workspaceFolders) {
            const fileCandidates = await Vscode.workspace.findFiles("**/*.eww");

            if (fileCandidates.length > 1) {
                const options = fileCandidates.map(file => {
                    return { label: Path.basename(file.fsPath), detail: file.fsPath };
                });
                return ThenableToPromise(Vscode.window.showQuickPick(options).then(option => option?.detail));
            } else if (fileCandidates.length === 1) {
                return Promise.resolve(fileCandidates[0]?.fsPath);
            } else {
                Vscode.window.showErrorMessage("No IAR Workspaces found.");
                return Promise.resolve(undefined);
            }
        } else {
            return Promise.resolve(undefined);
        }
    }
}
