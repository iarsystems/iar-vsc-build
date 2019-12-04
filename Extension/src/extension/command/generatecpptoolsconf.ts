/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import { CommandBase } from "./command";
import { CompilerListModel } from "../model/selectcompiler";
import { ConfigurationListModel } from "../model/selectconfiguration";
import { CppToolsConfigGenerator } from "../../vsc/CppToolsConfigGenerator";

export class GenerateCppToolsConfCommand extends CommandBase {
    private compilerModel: CompilerListModel;
    private configModel: ConfigurationListModel;

    constructor(compilerModel: CompilerListModel, configModel: ConfigurationListModel) {
        super("iar.generateCppToolsConfig");

        this.compilerModel = compilerModel;
        this.configModel = configModel;
    }

    executeImpl(): void {
        if (!this.canExecute()) {
            Vscode.window.showErrorMessage("You need to select a compiler and configuration to generate the cpptools config file");
            return;
        }
        Vscode.window.showInformationMessage("Generating cpptools config file");

        CppToolsConfigGenerator.generate(this.configModel.selected, this.compilerModel.selected).then((result) => {
            if (result) {
                Vscode.window.showErrorMessage(result.message);
            }
        });
    }

    /**
     * Checks whether the command has all data it needs to execute. While this function returns false,
     * executing the command will print an error message to the user.
     */
    canExecute(): boolean {
        return this.compilerModel.selected !== undefined && this.configModel.selected !== undefined;
    }
}

export namespace Command {
    export function createGenerateCppToolsConfig(compilerModel: CompilerListModel, configModel: ConfigurationListModel) {
        return new GenerateCppToolsConfCommand(compilerModel, configModel);
    }
}
