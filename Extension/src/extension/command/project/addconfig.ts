/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import { UI } from "../../ui/app";
import { ProjectCommand } from "./projectcommand";
import { Toolchain } from "../../../iar/thrift/bindings/projectmanager_types";
import { ConfigurationNode } from "../../ui/treeprojectview";

/**
 * This commands adds a configuration to a project (using a thrift ProjectManager)
 */
export class AddConfigCommand extends ProjectCommand {
    constructor() {
        super("iar.addConfig")
    }

    async execute(_source: ConfigurationNode) {
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
            let name = await Vscode.window.showInputBox({
                                                            prompt: "Enter a name for the new configuration",
                                                            placeHolder: "MyConfiguration" });
            if (!name) { return; }

            const existingConfigs = await pm.service.GetConfigurations(context);
            if (existingConfigs.some(conf => conf.name === name)) {
                throw `There is already a configuration called "${name}".`;
            }

            const toolchains = await pm.service.GetToolchains();
            const qpItems: Array<Vscode.QuickPickItem & { tc: Toolchain }> = toolchains.map(tc => {
                return {
                    label: tc.name,
                    description: tc.id,
                    tc: tc,
                };
            });
            const selectedTc = await Vscode.window.showQuickPick(qpItems, { placeHolder: "Select a toolchain" });
            if (!selectedTc) { return; }
            const debugResponse = await Vscode.window.showQuickPick(["yes", "no"], { placeHolder: "Is this a debug configuration?" });
            if (!debugResponse) { return; }
            const isDebug = debugResponse === "yes";

            const newConfig = { name, toolchainId: selectedTc.tc.id };
            await pm.service.AddConfiguration(newConfig, context, isDebug);

            // TODO: notify Model<Config> of this change?

            Vscode.window.showInformationMessage(`The configuration "${name}" has been added.`);
        } catch(e) {
            Vscode.window.showErrorMessage("Unable to add configuration: " + e.toString());
        }
    }
}