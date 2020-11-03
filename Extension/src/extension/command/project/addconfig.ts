/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import { ProjectCommand } from "./projectcommand";
import { Toolchain, Configuration } from "../../../iar/project/thrift/bindings/projectmanager_types";
import { ConfigurationNode } from "../../ui/treeprojectprovider";
import { ConfirmationDialog } from "../../ui/confirmationdialog";
import { ExtendedProject } from "../../../iar/project/project";
import { UI } from "../../ui/app";

/**
 * This command adds a configuration to a project (using a thrift ProjectManager)
 */
export class AddConfigCommand extends ProjectCommand {
    constructor() {
        super("iar.addConfig");
    }

    async execute(_source: ConfigurationNode, project: ExtendedProject) {
        try {
            const exWorkbench = UI.getInstance().extendedWorkbench.selected;
            if (!exWorkbench) {
                return;
            }
            let name = await Vscode.window.showInputBox({
                                                            prompt: "Enter a name for the new configuration",
                                                            placeHolder: "MyConfiguration" });
            if (!name) { return; }

            const existingConfigs = project.configurations;
            if (existingConfigs.some(conf => conf.name === name)) {
                throw new Error(`There is already a configuration called "${name}".`);
            }

            const toolchains = await exWorkbench.getToolchains();
            const qpItems: Array<Vscode.QuickPickItem & { tc: Toolchain }> = toolchains.map(tc => {
                return {
                    label: tc.name,
                    description: tc.id,
                    tc: tc,
                };
            });
            const selectedTc = await Vscode.window.showQuickPick(qpItems, { placeHolder: "Select a toolchain" });
            if (!selectedTc) { return; }
            const isDebug = await ConfirmationDialog.show("Is this a debug configuration?");
            if (isDebug === undefined) { return; }

            const newConfig: Configuration = new Configuration({ name, toolchainId: selectedTc.tc.id });
            await project.addConfiguration(newConfig, isDebug);

            Vscode.window.showInformationMessage(`The configuration "${name}" has been added.`);
        } catch(e) {
            Vscode.window.showErrorMessage("Unable to add configuration: " + e.toString());
        }
    }
}