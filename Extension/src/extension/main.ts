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
import { SettingsWebview } from "./ui/settingswebview";
import { AddWorkbenchCommand } from "./command/addworkbench";
import { Command } from "./command/command";

export function activate(context: vscode.ExtensionContext) {
    ExtensionState.init(IarVsc.toolManager);

    // --- create and register commands
    GetSettingsCommand.initCommands(context);
    new SelectIarWorkspace().register(context);
    new CreateProjectCommand().register(context);
    new ReloadProjectCommand().register(context);
    new RemoveNodeCommand().register(context);
    new AddFileCommand().register(context);
    new AddGroupCommand().register(context);
    const addWorkbenchCmd = new AddWorkbenchCommand(IarVsc.toolManager);
    addWorkbenchCmd.register(context);

    // --- initialize custom GUI
    const workbenchModel = ExtensionState.getInstance().workbench;
    const projectModel = ExtensionState.getInstance().project;
    const configModel = ExtensionState.getInstance().config;

    IarVsc.settingsView = new SettingsWebview(context.extensionUri, workbenchModel, projectModel, configModel, addWorkbenchCmd, ExtensionState.getInstance().loading);
    vscode.window.registerWebviewViewProvider(SettingsWebview.VIEW_TYPE, IarVsc.settingsView);
    IarVsc.projectTreeView = new TreeProjectView(
        projectModel,
        ExtensionState.getInstance().extendedProject,
        workbenchModel,
        ExtensionState.getInstance().extendedWorkbench,
        ExtensionState.getInstance().loading,
    );

    // --- find and add workbenches
    loadTools(addWorkbenchCmd);
    Settings.observeSetting(Settings.ExtensionSettingsField.IarInstallDirectories, () => loadTools());

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

async function loadTools(addWorkbenchCommand?: Command<unknown>) {
    const roots = Settings.getIarInstallDirectories();

    IarVsc.toolManager.collectFrom(roots);

    if (IarVsc.toolManager.workbenches.length === 0 && addWorkbenchCommand) {
        const response = await vscode.window.showErrorMessage("IAR: Unable to find any IAR Embedded Workbenches to use. You must locate one before you can use this extension.", "Add Workbench");
        if (response === "Add Workbench") {
            vscode.commands.executeCommand(addWorkbenchCommand.id);
        }
    }

}

export namespace IarVsc {
    export const toolManager = ToolManager.createIarToolManager();
    // exported mostly for testing purposes
    export let settingsView: SettingsWebview;
    export let projectTreeView: TreeProjectView;
}
