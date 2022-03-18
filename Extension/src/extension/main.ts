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
import { BuildExtensionApi } from "../../utils/buildExtension";
import { OsUtils } from "../../utils/osUtils";
import { Project } from "../iar/project/project";

export function activate(context: vscode.ExtensionContext): BuildExtensionApi {
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

    // Watch for creating/deleting projects in the workspace
    IarVsc.ewpFilesWatcher = vscode.workspace.createFileSystemWatcher("**/*.ewp", false, true, false);
    IarVsc.ewpFilesWatcher.onDidCreate(uri => {
        ExtensionState.getInstance().project.addProject(new Project(uri.fsPath));
    });
    IarVsc.ewpFilesWatcher.onDidDelete(uri => {
        const toRemove = ExtensionState.getInstance().project.projects.find(project => OsUtils.pathsEqual(project.path.toString(), uri.fsPath));
        if (toRemove) {
            ExtensionState.getInstance().project.removeProject(toRemove);
        }
    });

    // Public API
    return {
        getSelectedWorkbench() {
            return Promise.resolve(ExtensionState.getInstance().workbench.selected?.path.toString());
        },
        async getSelectedConfiguration(projectPath) {
            const loadedPath = (await ExtensionState.getInstance().loadedProject?.getValue())?.path.toString();
            if (loadedPath && OsUtils.pathsEqual(projectPath, loadedPath)) {
                const config = ExtensionState.getInstance().config.selected;
                if (config) {
                    return { name: config.name, target: config.toolchainId };
                }
            }
            return undefined;
        },
        async getProjectConfigurations(projectPath) {
            const loadedPath = (await ExtensionState.getInstance().loadedProject?.getValue())?.path.toString();
            if (loadedPath && OsUtils.pathsEqual(projectPath, loadedPath)) {
                return Promise.resolve(ExtensionState.getInstance().config.configurations.map(c => {
                    return { name: c.name, target: c.toolchainId };
                }));
            }
            return undefined;
        },
        async getLoadedProject() {
            const project = await ExtensionState.getInstance().loadedProject.getValue();
            return project?.path.toString();
        },
        async getCSpyCommandline(projectPath, configuration) {
            const project = await ExtensionState.getInstance().extendedProject.getValue();
            if (project === undefined || !OsUtils.pathsEqual(projectPath, project.path.toString())) {
                return undefined;
            }
            return project.getCSpyArguments(configuration);
        },
    };
}

export async function deactivate() {
    IarVsc.ewpFilesWatcher?.dispose();
    if (IarConfigurationProvider.instance) {
        IarConfigurationProvider.instance.dispose();
    }
    IarTaskProvider.unregister();
    CStatTaskProvider.unRegister();
    await ExtensionState.getInstance().dispose();
}

async function loadTools(addWorkbenchCommand?: Command<unknown>) {
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
    export let ewpFilesWatcher: vscode.FileSystemWatcher;
}
