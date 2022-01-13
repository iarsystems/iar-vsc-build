/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */




import * as vscode from "vscode";
import { UI } from "./extension/ui/app";
import { ToolManager } from "./iar/tools/manager";
import { Settings } from "./extension/settings";
import { SettingsMonitor } from "./extension/settingsmonitor";
import { IarTaskProvider } from "./extension/task/provider";
import { GetSettingsCommand } from "./extension/command/getsettings";
import { IarConfigurationProvider } from "./extension/configprovider/configurationprovider";
import { CStatTaskProvider } from "./extension/task/cstat/cstattaskprovider";
import { BuildTaskProvider } from "./extension/task/thriftbuild/buildtaskprovider";

export function activate(context: vscode.ExtensionContext) {
    GetSettingsCommand.initCommands(context);
    UI.init(context, IarVsc.toolManager);

    SettingsMonitor.monitorWorkbench(UI.getInstance().workbench.model);
    SettingsMonitor.monitorProject(UI.getInstance().project.model);
    SettingsMonitor.monitorConfiguration(UI.getInstance().config.model);
    UI.getInstance().show();

    loadTools();
    Settings.observeSetting(Settings.ExtensionSettingsField.IarInstallDirectories, loadTools);

    IarConfigurationProvider.init();
    IarTaskProvider.register();
    BuildTaskProvider.register();
    CStatTaskProvider.register(context);
}

export function deactivate() {
    if (IarConfigurationProvider.instance) {
        IarConfigurationProvider.instance.dispose();
    }
    IarTaskProvider.unregister();
    CStatTaskProvider.unRegister();
    UI.getInstance().dispose();
}

function loadTools() {
    const roots = Settings.getIarInstallDirectories();

    roots.forEach(path => {
        IarVsc.toolManager.collectFrom(path);
    });

    if (IarVsc.toolManager.workbenches.length === 0) {
        vscode.window.showErrorMessage("IAR: Unable to find any IAR workbenches to use, you will need to configure this to use the extension (see [the documentation](https://iar-vsc.readthedocs.io/en/latest/pages/user_guide.html#extension-settings))");
    }

}

namespace IarVsc {
    export const toolManager = ToolManager.createIarToolManager();
}
