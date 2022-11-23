/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { logger } from "iar-vsc-common/logger";
import { OsUtils } from "iar-vsc-common/osUtils";
import * as vscode from "vscode";
import { ArgVarsFile } from "../iar/project/argvarfile";
import { ExtensionState } from "./extensionstate";

/**
 * Reacts to created/changed/deleted .ewp files in the open workspace folders in order to keep the list of available
 * projects up-to-date, and in order to reload projects when they are changed externally, e.g. from Embedded Workbench.
 */
export class ArgVarFileWatcherService {
    private readonly filesWatcher: vscode.FileSystemWatcher;

    constructor() {
        this.filesWatcher = vscode.workspace.createFileSystemWatcher("**/*.custom_argvars");
        this.filesWatcher.onDidCreate(path => {
            logger.debug("Detected new argvars file: " + path.fsPath);
            ExtensionState.getInstance().argVarsFile.addArgVarsFile(ArgVarsFile.fromFile(path.fsPath));
        });


        this.filesWatcher.onDidDelete(path => {
            const toRemove = ExtensionState.getInstance().argVarsFile.argVarsFiles.find(file => OsUtils.pathsEqual(file.path, path.fsPath));
            if (toRemove) {
                logger.debug("Removing deleted argvars file: " + path);
                ExtensionState.getInstance().argVarsFile.removeArgVarsFile(toRemove);
            }
        });


        this.filesWatcher.onDidChange(async path => {
            logger.debug(`'${path}' changed on disk`);

            // Reload the project from disk if it is currently loaded
            const currentArgVar = await ExtensionState.getInstance().argVarsFile.selected;
            if (currentArgVar && OsUtils.pathsEqual(currentArgVar.path, path.fsPath)) {
                await ExtensionState.getInstance().reloadArgVarsFile();
            }
        });
    }

    dispose() {
        this.filesWatcher.dispose();
    }
}
