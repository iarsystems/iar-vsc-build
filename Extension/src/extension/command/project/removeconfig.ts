/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import { UI } from "../../ui/app";
import { ConfirmationDialog } from "../../ui/confirmationdialog";
import { ConfigurationNode } from "../../ui/treeprojectview";
import { ProjectCommand } from "./projectcommand";

/**
 * This commands removes a configuration from a project (using a thrift ProjectManager)
 */
export class RemoveConfigCommand extends ProjectCommand {
    constructor() {
        super("iar.removeConfig")
    }

    async execute(source: ConfigurationNode) {
        try {
            const workbench = UI.getInstance().workbench.model.selected;
            if (!workbench) {
                return;
            }
            const pm = UI.getInstance().projectManager;
            if (!pm) {
                return;
            }
            const context = UI.getInstance().projectContext;
            if (!context) {
                return;
            }
            const toRemove = source.config;

            const shouldRemove = await ConfirmationDialog.show(`Really remove "${toRemove.name}"?`);
            if (!shouldRemove) {
                return;
            }

            await pm.service.RemoveConfiguration(toRemove.name, context);

            // TODO: notify Model<Config> of this change?

            Vscode.window.showInformationMessage(`The configuration "${toRemove.name}" has been removed from the project.`);
        } catch(e) {
            Vscode.window.showErrorMessage("Unable to remove configuration: " + e.toString());
        }
    }
}