/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import { CommandBase } from "./command";
import { CompilerListModel } from "../model/selectcompiler";
import { ConfigurationListModel } from "../model/selectconfiguration";
import { IarConfigurationProvider } from "../configprovider/configurationprovider";

class RegenerateCppToolsConfCommand extends CommandBase {

    constructor(_compilerModel: CompilerListModel, _configModel: ConfigurationListModel) {
        super("iar.regenerateCppToolsConfig");
    }

    executeImpl(): void {
        const provider = IarConfigurationProvider.instance;
        if (provider) {
            provider.forceUpdate().then(() => {
                Vscode.window.showInformationMessage("Project configuration reloaded.");
            });
        }
    }
}

export namespace Command {
    export function createRegenerateCppToolsConfig(compilerModel: CompilerListModel, configModel: ConfigurationListModel) {
        return new RegenerateCppToolsConfCommand(compilerModel, configModel);
    }
}
