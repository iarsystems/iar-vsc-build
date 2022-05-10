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
import { ReloadProjectCommand } from "./command/project/reloadproject";
import { RemoveNodeCommand } from "./command/project/removenode";
import { AddFileCommand, AddGroupCommand } from "./command/project/addnode";
import { SettingsWebview } from "./ui/settingswebview";
import { AddWorkbenchCommand } from "./command/addworkbench";
import { Command } from "./command/command";
import { BuildExtensionApi } from "iar-vsc-common/buildExtension";
import { Project } from "../iar/project/project";
import { logger } from "iar-vsc-common/logger";
import { EwpFile } from "../iar/project/parsing/ewpfile";
import { EwpFileWatcherService } from "./ewpfilewatcher";
import { API } from "./api";

export function activate(context: vscode.ExtensionContext): BuildExtensionApi {
    logger.init("IAR Build");
    logger.debug("Activating extension");
    IarVsc.extensionContext = context;
    ExtensionState.init(IarVsc.toolManager);

    // --- create and register commands
    GetSettingsCommand.initCommands(context);
    new SelectIarWorkspace().register(context);
    new ReloadProjectCommand().register(context);
    new RemoveNodeCommand().register(context);
    new AddFileCommand().register(context);
    new AddGroupCommand().register(context);
    const addWorkbenchCmd = new AddWorkbenchCommand(IarVsc.toolManager);
    addWorkbenchCmd.register(context);
    Command.createSelectWorkbenchCommand(ExtensionState.getInstance().workbench).register(context);
    Command.createSelectProjectCommand(ExtensionState.getInstance().project).register(context);
    Command.createSelectConfigurationCommand(ExtensionState.getInstance().config).register(context);

    // --- initialize custom GUI
    const workbenchModel = ExtensionState.getInstance().workbench;
    const projectModel = ExtensionState.getInstance().project;
    const configModel = ExtensionState.getInstance().config;

    IarVsc.settingsView = new SettingsWebview(context.extensionUri, workbenchModel, projectModel, configModel, addWorkbenchCmd);
    vscode.window.registerWebviewViewProvider(SettingsWebview.VIEW_TYPE, IarVsc.settingsView);
    IarVsc.projectTreeView = new TreeProjectView(
        projectModel,
        ExtensionState.getInstance().extendedProject,
        workbenchModel,
        ExtensionState.getInstance().extendedWorkbench,
        ExtensionState.getInstance().loading,
    );

    // --- register tasks
    IarTaskProvider.register();
    CStatTaskProvider.register(context);

    // --- start cpptools interface
    IarConfigurationProvider.init();

    // --- watch for creating/deleting/modifying projects in the workspace
    IarVsc.ewpFilesWatcher = new EwpFileWatcherService();

    // --- find and add all .ewp projects
    // note that we do not await here, this operation can be slow and we want activation to be quick
    findProjectsInWorkspace();
    vscode.workspace.onDidChangeWorkspaceFolders(() => findProjectsInWorkspace());

    // --- find and add workbenches
    loadTools(addWorkbenchCmd);
    Settings.observeSetting(Settings.ExtensionSettingsField.IarInstallDirectories, () => loadTools());


    // --- provide the public typescript API
    return API;
}

export async function deactivate() {
    logger.debug("Deactivating extension");
    IarVsc.ewpFilesWatcher?.dispose();
    if (IarConfigurationProvider.instance) {
        IarConfigurationProvider.instance.close();
    }
    IarTaskProvider.unregister();
    CStatTaskProvider.unRegister();
    await ExtensionState.getInstance().dispose();
}

async function findProjectsInWorkspace() {
    if (vscode.workspace.workspaceFolders !== undefined) {
        const projectFiles = (await vscode.workspace.findFiles("**/*.ewp")).filter(uri => !Project.isBackupFile(uri.fsPath));
        logger.debug(`Found ${projectFiles.length} project(s) in the workspace`);
        const projects: Project[] = [];
        projectFiles.forEach(uri => {
            try {
                projects.push(new EwpFile(uri.fsPath));
            } catch (e) {
                logger.error(`Could not parse project file '${uri.fsPath}': ${e}`);
                vscode.window.showErrorMessage(`Could not parse project file '${uri.fsPath}': ${e}`);
            }
        });
        ExtensionState.getInstance().project.set(...projects.sort((a, b) => a.name.localeCompare(b.name)));
    }
}

async function loadTools(addWorkbenchCommand?: Command<unknown>) {
    logger.debug("Scanning for toolchains...");
    const roots = Settings.getIarInstallDirectories();

    await IarVsc.toolManager.collectWorkbenches(roots, true);
    if (IarVsc.toolManager.workbenches.length === 0 && addWorkbenchCommand) {
        const response = await vscode.window.showErrorMessage("Unable to find any IAR toolchains to use. You must locate one before you can use this extension.", "Add IAR toolchain");
        if (response === "Add IAR toolchain") {
            vscode.commands.executeCommand(addWorkbenchCommand.id);
        }
    }

}

export namespace IarVsc {
    export let extensionContext: vscode.ExtensionContext | undefined;
    export const toolManager = ToolManager.createIarToolManager();
    // exported mostly for testing purposes
    export let settingsView: SettingsWebview;
    export let projectTreeView: TreeProjectView;
    export let ewpFilesWatcher: EwpFileWatcherService;
}
