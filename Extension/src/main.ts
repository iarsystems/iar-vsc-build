/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';


import * as vscode from 'vscode';
import { UI } from './extension/ui/app';
import { ToolManager } from './iar/tools/manager';
import { Settings } from './extension/settings';
import { SettingsMonitor } from './extension/settingsmonitor';
import { IarTaskProvider } from './extension/task/provider';
import { GetSettingsCommand } from "./extension/command/getsettings";
import { Logging } from './utils/logging';
import { IarConfigurationProvider } from './extension/configprovider/configurationprovider';

export async function activate(context: vscode.ExtensionContext) {
    Logging.setup(context);

    GetSettingsCommand.initCommands(context);
    UI.init(context, IarVsc.toolManager);

    SettingsMonitor.monitorWorkbench(UI.getInstance().workbench.model);
    SettingsMonitor.monitorCompiler(UI.getInstance().compiler.model);
    SettingsMonitor.monitorProject(UI.getInstance().project.model);
    SettingsMonitor.monitorConfiguration(UI.getInstance().config.model);
    UI.getInstance().show();

    let roots = Settings.getIarInstallDirectories();

    roots.forEach(path => {
        IarVsc.toolManager.collectFrom(path);
    });

    IarConfigurationProvider.init();
    IarTaskProvider.register();
}

export function deactivate() {
    if (IarConfigurationProvider.instance) {
        IarConfigurationProvider.instance.dispose();
    }
    IarTaskProvider.unregister();
}

namespace IarVsc {
    export let toolManager = ToolManager.createIarToolManager();
}
