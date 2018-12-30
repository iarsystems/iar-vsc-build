
'use strict';

import * as Vscode from "vscode";
import { CommandBase } from "./command";
import { CompilerListModel } from "../model/selectcompiler";
import { ConfigurationListModel } from "../model/selectconfiguration";
import { CppToolsConfigGenerator } from "../../vsc/CppToolsConfigGenerator";

class GenerateCppToolsConfCommand extends CommandBase {
    private compilerModel: CompilerListModel;
    private configModel: ConfigurationListModel;

    constructor(compilerModel: CompilerListModel, configModel: ConfigurationListModel) {
        super("iar.generateCppToolsConfig");

        this.compilerModel = compilerModel;
        this.configModel = configModel;
    }

    execute(): void {
        let result = CppToolsConfigGenerator.generate(this.configModel.selected, this.compilerModel.selected);

        if (result) {
            Vscode.window.showErrorMessage(result.message);
        }
    }
}

export namespace Command {
    export function createGenerateCppToolsConfig(compilerModel: CompilerListModel, configModel: ConfigurationListModel) {
        return new GenerateCppToolsConfCommand(compilerModel, configModel);
    }
}
