/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as vscode from "vscode";
import { Settings } from "../settings";
import { CommandBase } from "./command";
import { ToolManager } from "../../iar/tools/manager";
import { OsUtils } from "iar-vsc-common/osUtils";

/**
 * Opens a file picker dialog and lets the user add a new folder containing workbench installations.
 * That folder will then be scanned to find workbenches to use.
 * Returns true if a folder containing any workbenches was successfully added.
 */
export class AddWorkbenchCommand extends CommandBase<Promise<boolean>> {
    public static readonly ID = "iar.addToolchain";

    constructor(private readonly toolManager: ToolManager) {
        super(AddWorkbenchCommand.ID);
    }

    async executeImpl() {
        const uris = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: "Select an IAR toolchain (IAR Embedded Workbench or IAR Build Tools) installation folder"
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

        const foundWorkbenches = await this.toolManager.collectWorkbenches([uri.fsPath], false);
        if (foundWorkbenches.length === 0) {
            vscode.window.showErrorMessage("Could not find any IAR toolchains in that folder. Please choose the root folder of an IAR Embedded Workbench or IAR Build Tools installation (e.g. D:/IAR Systems/Embedded Workbench 9.0/).");
            return false;
        }
        vscode.window.showInformationMessage("Found " + foundWorkbenches.map(wb => `'${wb.name}'`).join(", "));

        installDirs.push(uri.fsPath);
        Settings.setIarInstallDirectories(installDirs);
        return true;
    }
}
