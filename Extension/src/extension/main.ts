/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as vscode from "vscode";
import { ExtensionState } from "./extensionstate";
import { ToolManager } from "../iar/tools/manager";
import { Settings } from "./settings";
import { IarTaskProvider } from "./task/provider";
import { GetSettingsCommand } from "./command/getsettings";
import { IarConfigurationProvider } from "./configprovider/configurationprovider";
import { CStatTaskProvider } from "./task/cstat/cstattaskprovider";
import { TreeProjectView } from "./ui/treeprojectview";
import { SelectIarWorkspace } from "./command/selectIarWorkspace";
import { CreateProjectCommand } from "./command/project/createproject";
import { ReloadProjectCommand } from "./command/project/reloadproject";
import { RemoveNodeCommand } from "./command/project/removenode";
import { AddFileCommand, AddGroupCommand } from "./command/project/addnode";
import { Command as RegenerateCommand } from "./command/regeneratecpptoolsconf";
import { SettingsWebview } from "./ui/settingswebview";

export function activate(context: vscode.ExtensionContext) {
    ExtensionState.init(IarVsc.toolManager);

    // --- create and register commands
    GetSettingsCommand.initCommands(context);
    RegenerateCommand.createRegenerateCppToolsConfig().register(context);
    new SelectIarWorkspace().register(context);
    new CreateProjectCommand().register(context);
    new ReloadProjectCommand().register(context);
    new RemoveNodeCommand().register(context);
    new AddFileCommand().register(context);
    new AddGroupCommand().register(context);

    // --- initialize custom GUI
    const workbenchModel = ExtensionState.getInstance().workbench;
    const projectModel = ExtensionState.getInstance().project;
    // const configModel = ExtensionState.getInstance().config;

    IarVsc.settingsView = new SettingsWebview(context.extensionUri);
    vscode.window.registerWebviewViewProvider(SettingsWebview.VIEW_TYPE, IarVsc.settingsView);
    // vscode.window.registerTreeDataProvider("iar-settings", IarVsc.settingsTreeView);
    IarVsc.projectTreeView = new TreeProjectView(
        projectModel,
        ExtensionState.getInstance().extendedProject,
        workbenchModel,
        ExtensionState.getInstance().extendedWorkbench,
        ExtensionState.getInstance().loading,
    );

    // --- find and add workbenches
    loadTools();
    Settings.observeSetting(Settings.ExtensionSettingsField.IarInstallDirectories, loadTools);

    // --- register tasks
    IarTaskProvider.register();
    CStatTaskProvider.register(context);

    // -- start cpptools interface
    IarConfigurationProvider.init();
}

export async function deactivate() {
    if (IarConfigurationProvider.instance) {
        IarConfigurationProvider.instance.dispose();
    }
    IarTaskProvider.unregister();
    CStatTaskProvider.unRegister();
    await ExtensionState.getInstance().dispose();
}

function loadTools() {
    const roots = Settings.getIarInstallDirectories();

    IarVsc.toolManager.collectFrom(roots);

    if (IarVsc.toolManager.workbenches.length === 0) {
        vscode.window.showErrorMessage("IAR: Unable to find any IAR workbenches to use, you will need to configure this to use the extension (see [the documentation](https://iar-vsc.readthedocs.io/en/latest/pages/user_guide.html#extension-settings))");
    }

}

export namespace IarVsc {
    export const toolManager = ToolManager.createIarToolManager();
    // exported mostly for testing purposes
    export let settingsView: SettingsWebview;
    export let projectTreeView: TreeProjectView;
}
