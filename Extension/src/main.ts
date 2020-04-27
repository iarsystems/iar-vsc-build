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
import { CStatTaskProvider } from './extension/task/cstat/cstattaskprovider';

export function activate(context: vscode.ExtensionContext) {
    GetSettingsCommand.initCommands(context);
    UI.init(context, IarVsc.toolManager);

    SettingsMonitor.monitorWorkbench(UI.getInstance().workbench.model);
    SettingsMonitor.monitorCompiler(UI.getInstance().compiler.model);
    SettingsMonitor.monitorProject(UI.getInstance().project.model);
    SettingsMonitor.monitorConfiguration(UI.getInstance().config.model);
    UI.getInstance().show();

    loadTools();
    Settings.observeSetting(Settings.Field.IarInstallDirectories, loadTools);

    IarTaskProvider.register();
    CStatTaskProvider.register(context);
}

export function deactivate() {
    IarTaskProvider.unregister();
    CStatTaskProvider.unRegister();
}

function loadTools() {
    let roots = Settings.getIarInstallDirectories();

    roots.forEach(path => {
        IarVsc.toolManager.collectFrom(path);
    });

    if (IarVsc.toolManager.workbenches.length === 0) {
        vscode.window.showErrorMessage("IAR: Unable to find any IAR workbenches to use, you will need to configure this to use the extension (see [the documentation](https://iar-vsc.readthedocs.io/en/latest/pages/user_guide.html#extension-settings))");
    }

}

namespace IarVsc {
    export let toolManager = ToolManager.createIarToolManager();
}
