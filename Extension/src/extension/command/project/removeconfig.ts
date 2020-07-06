/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import { ConfirmationDialog } from "../../ui/confirmationdialog";
import { ConfigurationNode } from "../../ui/treeprojectprovider";
import { ProjectCommand } from "./projectcommand";
import { ExtendedProject } from "../../../iar/project/project";

/**
 * This command removes a configuration from a project (using a thrift ProjectManager)
 */
export class RemoveConfigCommand extends ProjectCommand {
    constructor() {
        super("iar.removeConfig");
    }

    async execute(source: ConfigurationNode, project: ExtendedProject) {
        try {
            const toRemove = source.config;

            const shouldRemove = await ConfirmationDialog.show(`Really remove "${toRemove.name}"?`);
            if (!shouldRemove) {
                return;
            }

            await project.removeConfiguration(toRemove);

            Vscode.window.showInformationMessage(`The configuration "${toRemove.name}" has been removed from the project.`);
        } catch(e) {
            Vscode.window.showErrorMessage("Unable to remove configuration: " + e.toString());
        }
    }
}