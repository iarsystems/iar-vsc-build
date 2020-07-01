/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import { ProjectNode } from "../../ui/treeprojectview";

/**
 * Base class for commands that are called as context buttons from the {@link TreeProjectView} (where files and configs are managed).
 */
export abstract class ProjectCommand {
    enabled: boolean = true;

    constructor(public command: string) {
    }

    canExecute(): boolean {
        return true;
    }

    register(context: Vscode.ExtensionContext): void {
        let cmd = Vscode.commands.registerCommand(this.command, (source): any => {
            return this.execute(source);
        }, this);

        context.subscriptions.push(cmd);
    }

    /**
     * Called to run the command
     * @param source The item in the tree view that was clicked to spawn this command
     */
    abstract execute(source: ProjectNode): any;
}