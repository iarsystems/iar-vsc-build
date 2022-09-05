/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as vscode from "vscode";
import { ExtensionState } from "./extensionstate";
import { IarToolManager } from "../iar/tools/manager";
import { Settings } from "./settings";
import { IarTaskProvider } from "./task/provider";
import { GetSettingsCommand } from "./command/getsettings";
import { IarConfigurationProvider } from "./cpptools/configurationprovider";
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
import { StatusBarItem } from "./ui/statusbaritem";
import { BehaviorSubject } from "rxjs";
import { ArgVarsFile } from "../iar/project/argvarfile";
import { ArgVarFileWatcherService } from "./argvarfilewatcher";

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
    const workbenchCmd = Command.createSelectWorkbenchCommand(ExtensionState.getInstance().workbench);
    workbenchCmd.register(context);
    const projectCmd = Command.createSelectProjectCommand(ExtensionState.getInstance().project);
    projectCmd.register(context);
    const configCmd = Command.createSelectConfigurationCommand(ExtensionState.getInstance().config);
    configCmd.register(context);
    Command.createSelectArgVarsFileCommand(ExtensionState.getInstance().argVarsFile).register(context);

    // --- initialize custom GUI
    const workbenchModel = ExtensionState.getInstance().workbench;
    const projectModel = ExtensionState.getInstance().project;
    const configModel = ExtensionState.getInstance().config;
    const argVarModel = ExtensionState.getInstance().argVarsFile;

    IarVsc.settingsView = new SettingsWebview(context.extensionUri, workbenchModel, projectModel, configModel, argVarModel, addWorkbenchCmd, IarVsc.workbenchesLoading);
    vscode.window.registerWebviewViewProvider(SettingsWebview.VIEW_TYPE, IarVsc.settingsView);
    IarVsc.projectTreeView = new TreeProjectView(
        projectModel,
        ExtensionState.getInstance().extendedProject,
        workbenchModel,
        ExtensionState.getInstance().extendedWorkbench,
        ExtensionState.getInstance().loading,
    );

    StatusBarItem.createFromModel("iar.workbench", ExtensionState.getInstance().workbench, workbenchCmd, "IAR Toolchain: ", 4);
    StatusBarItem.createFromModel("iar.project", ExtensionState.getInstance().project, projectCmd, "Project: ", 3);
    StatusBarItem.createFromModel("iar.configuration", ExtensionState.getInstance().config, configCmd, "Configuration: ", 2);

    // --- register tasks
    IarTaskProvider.register();
    CStatTaskProvider.register(context);

    // --- start cpptools interface
    IarConfigurationProvider.init();

    // --- watch for creating/deleting/modifying projects and .custom_argvars files in the workspace
    IarVsc.ewpFilesWatcher = new EwpFileWatcherService();
    IarVsc.argVarsFilesWatcher = new ArgVarFileWatcherService();

    // --- find and add all .ewp projects and.custom_argvars files
    // note that we do not await here, this operation can be slow and we want activation to be quick
    findIARFilesInWorkspace();
    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => findIARFilesInWorkspace()));
    Settings.observeSetting(Settings.ExtensionSettingsField.ProjectsToExclude, () => findIARFilesInWorkspace());

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

// Finds .ewp and .custom_argvars files
async function findIARFilesInWorkspace() {
    if (vscode.workspace.workspaceFolders !== undefined) {
        const doneFindingArgVars = vscode.workspace.findFiles("**/*.custom_argvars").then(files => {
            const argVarsFiles = files.map(file => ArgVarsFile.fromFile(file.fsPath));
            ExtensionState.getInstance().argVarsFile.set(...argVarsFiles.sort((av1, av2) => av1.name.localeCompare(av2.name)));
        });

        const projectFiles = (await vscode.workspace.findFiles("**/*.ewp")).filter(uri => !Project.isIgnoredFile(uri.fsPath));
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
        // ArgVars should be set before the projects, since an argvars file may be required to load the project
        await doneFindingArgVars;
        ExtensionState.getInstance().project.set(...projects.sort((a, b) => a.name.localeCompare(b.name)));
    }
}

async function loadTools(addWorkbenchCommand?: Command<unknown>) {
    IarVsc.workbenchesLoading.next(true);
    const roots = Settings.getIarInstallDirectories();

    await IarVsc.toolManager.collectWorkbenches(roots, false);
    if (IarVsc.toolManager.workbenches.length === 0 && addWorkbenchCommand) {
        const response = await vscode.window.showErrorMessage("Unable to find any IAR toolchains to use. You must locate one before you can use this extension.", "Add IAR toolchain");
        if (response === "Add IAR toolchain") {
            vscode.commands.executeCommand(addWorkbenchCommand.id);
        }
    }
    IarVsc.workbenchesLoading.next(false);

}

export namespace IarVsc {
    export let extensionContext: vscode.ExtensionContext | undefined;
    export const toolManager = new IarToolManager();
    export const workbenchesLoading = new BehaviorSubject<boolean>(false);
    // exported mostly for testing purposes
    export let settingsView: SettingsWebview;
    export let projectTreeView: TreeProjectView;
    export let ewpFilesWatcher: EwpFileWatcherService;
    export let argVarsFilesWatcher: ArgVarFileWatcherService;
}
