/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import { CommandBase } from "./command";
import { CompilerListModel } from "../model/selectcompiler";
import { ConfigurationListModel } from "../model/selectconfiguration";

class GenerateCppToolsConfCommand extends CommandBase {

    constructor(_compilerModel: CompilerListModel, _configModel: ConfigurationListModel) {
        super("iar.generateCppToolsConfig");

    }

    executeImpl(): void {
        Vscode.window.showInformationMessage("Generating cpptools config file");

        // CppToolsConfigGenerator.generate("c", this.configModel.selected, this.compilerModel.selected).then((result) => {
        //     if (result) {
        //         Vscode.window.showErrorMessage(result.message);
        //     }
        // });
    }
}

export namespace Command {
    export function createGenerateCppToolsConfig(compilerModel: CompilerListModel, configModel: ConfigurationListModel) {
        return new GenerateCppToolsConfCommand(compilerModel, configModel);
    }
}
