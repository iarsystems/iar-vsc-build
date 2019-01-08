
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

    /* FIXME: interface says, `void`, we say `any`: fix this! */
    execute(): any {
        if (Vscode.workspace.rootPath) {
            let workspaceFolder = Vscode.workspace.rootPath;

            let filter = FsUtils.createFilteredListDirectoryFilenameRegex(/\.*\.eww/);
            let files = FsUtils.filteredListDirectory(workspaceFolder, filter);

            let workspacePaths: string[] = [];

            files.forEach(file => {
                let relativePath = Path.relative(workspaceFolder.toString(), file.toString());
                workspacePaths.push(relativePath);
            });

            return Vscode.window.showQuickPick(workspacePaths);
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
