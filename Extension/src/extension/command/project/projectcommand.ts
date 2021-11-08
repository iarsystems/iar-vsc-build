/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import { ProjectNode } from "../../ui/treeprojectprovider";
import { UI } from "../../ui/app";
import { ExtendedProject } from "../../../iar/project/project";

/**
 * Base class for commands that are called as context buttons from the {@link TreeProjectView} (where files and configs are managed).
 */
export abstract class ProjectCommand {

    constructor(public command: string) {
    }

    canExecute(): boolean {
        return true;
    }

    register(context: Vscode.ExtensionContext): void {
        const cmd = Vscode.commands.registerCommand(this.command, (source): void | Promise<void> => {
            const proj = UI.getInstance().extendedProject.selected;
            if (proj === undefined || source === undefined) {
                return;
            }

            return this.execute(source, proj);
        }, this);

        context.subscriptions.push(cmd);
    }

    /**
     * Called to run the command
     * @param source The item in the tree view that was clicked to spawn this command
     */
    abstract execute(source: ProjectNode, project: ExtendedProject): void | Promise<void>;
}