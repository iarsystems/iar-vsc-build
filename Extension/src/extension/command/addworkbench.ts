/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as vscode from "vscode";
import { Settings } from "../settings";
import { CommandBase } from "./command";
import { ToolManager } from "../../iar/tools/manager";
import { OsUtils } from "../../../utils/osUtils";

/**
 * Opens a file picker dialog and lets the user add a new folder containing workbench installations.
 * That folder will then be scanned to find workbenches to use.
 * Returns true if a folder containing any workbenches was successfully added.
 */
export class AddWorkbenchCommand extends CommandBase<Promise<boolean>> {

    constructor(private readonly toolManager: ToolManager) {
        super("iar.addWorkbench");
    }

    async executeImpl() {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: "Select an IAR Embedded Workbench installation folder"
        });
        if (!uris) {
            return false;
        }
        const uri = uris[0];
        if (!uri) {
            return false;
        }

        const installDirs: string[] = Settings.getIarInstallDirectories().map(dir => dir.toString());
        // Do we already have this install directory?
        const equivalentDir = installDirs.find(installDir => {
            return OsUtils.pathsEqual(installDir, uri.fsPath);
        });
        if (equivalentDir) {
            vscode.window.showInformationMessage(`That folder has already been added (${equivalentDir}).`);
            return false;
        }

        const foundWorkbenches = this.toolManager.collectFrom([uri.fsPath]);
        if (foundWorkbenches.length === 0) {
            vscode.window.showErrorMessage("Could not find any workbenches in that folder. Please choose the root folder of an IAR Embedded Workbench installation (e.g. D:/IAR Systems/Embedded Workbench 9.0/), or its parent.");
            return false;
        }
        vscode.window.showInformationMessage("Found " + foundWorkbenches.map(wb => `'${wb.name}'`).join(", "));

        installDirs.push(uri.fsPath);
        vscode.workspace.getConfiguration("iarvsc").update(Settings.ExtensionSettingsField.IarInstallDirectories, installDirs, true);
        return true;
    }
}
