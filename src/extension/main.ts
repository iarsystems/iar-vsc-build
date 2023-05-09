/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as vscode from "vscode";
import { ExtensionState } from "./extensionstate";
import { IarToolManager } from "../iar/tools/manager";
import { Settings } from "./settings";
import { IarTaskProvider } from "./task/provider";
import { GetSettingsCommand } from "./command/getsettings";
import { CpptoolsIntellisenseService } from "./intellisense/cpptoolsintellisenseservice";
import { CStatTaskProvider } from "./task/cstat/cstattaskprovider";
import { TreeProjectView } from "./ui/treeprojectview";
import { SelectIarWorkspace } from "./command/selectIarWorkspace";
import { ReloadProjectCommand } from "./command/project/reloadproject";
import { RemoveNodeCommand } from "./command/project/removenode";
import { AddFileCommand, AddFileToRootCommand, AddGroupCommand, AddGroupToRootCommand } from "./command/project/addnode";
import { SettingsWebview } from "./ui/settingswebview";
import { AddWorkbenchCommand } from "./command/addworkbench";
import { Command } from "./command/command";
import { BuildExtensionApi } from "iar-vsc-common/buildExtension";
import { Project } from "../iar/project/project";
import { logger } from "iar-vsc-common/logger";
import { EwpFile } from "../iar/project/parsing/ewpfile";
import { FileListWatcher } from "./filelistwatcher";
import { API } from "./api";
import { StatusBarItem } from "./ui/statusbaritem";
import { BehaviorSubject } from "rxjs";
import { ArgVarsFile } from "../iar/project/argvarfile";
import { ToolbarWebview } from "./ui/toolbarview";
import { ToggleCstatToolbarCommand } from "./command/togglecstattoolbar";
import { OsUtils } from "iar-vsc-common/osUtils";

export function activate(context: vscode.ExtensionContext): BuildExtensionApi {
    logger.init("IAR Build");
    logger.debug("Activating extension");
    IarVsc.extensionContext = context;
    ExtensionState.init(IarVsc.toolManager);

    // --- create and register commands
    GetSettingsCommand.initCommands(context);
    new SelectIarWorkspace().register(context);
    new ReloadProjectCommand().register(context);
    new AddFileToRootCommand().register(context);
    new AddGroupToRootCommand().register(context);
    new AddFileCommand().register(context);
    new AddGroupCommand().register(context);
    new RemoveNodeCommand().register(context);
    new ToggleCstatToolbarCommand().register(context);
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
    vscode.window.registerWebviewViewProvider(ToolbarWebview.VIEW_TYPE, new ToolbarWebview(context.extensionUri));
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
    CpptoolsIntellisenseService.init();

    // --- find and add all .ewp projects and.custom_argvars files
    // note that we do not await here, this operation can be slow and we want activation to be quick
    setupFileWatchers(context);

    // --- find and add workbenches
    loadTools(addWorkbenchCmd);
    Settings.observeSetting(Settings.ExtensionSettingsField.IarInstallDirectories, () => loadTools());


    // --- provide the public typescript API
    return API;
}

export async function deactivate() {
    logger.debug("Deactivating extension");
    if (CpptoolsIntellisenseService.instance) {
        CpptoolsIntellisenseService.instance.close();
    }
    IarTaskProvider.unregister();
    CStatTaskProvider.unRegister();
    await ExtensionState.getInstance().dispose();
}

async function setupFileWatchers(context: vscode.ExtensionContext) {
    const argvarsWatcher = await FileListWatcher.initialize("**/*.custom_argvars");
    context.subscriptions.push(argvarsWatcher);
    argvarsWatcher.subscribe(files => {
        const argVarsFiles = files.map(file => ArgVarsFile.fromFile(file));
        argVarsFiles.sort((av1, av2) => av1.name.localeCompare(av2.name));
        ExtensionState.getInstance().argVarsFile.set(...argVarsFiles);
    });

    const ewpWatcher = await FileListWatcher.initialize("**/*.ewp");
    context.subscriptions.push(ewpWatcher);

    ewpWatcher.subscribe(files => {
        const projects: Project[] = [];
        files.
            filter(file => !Project.isIgnoredFile(file)).
            forEach(file => {
                try {
                    projects.push(new EwpFile(file));
                } catch (e) {
                    logger.error(`Could not parse project file '${file}': ${e}`);
                    vscode.window.showErrorMessage(
                        `Could not parse project file '${file}': ${e}`
                    );
                }
            });
        logger.debug(`Found ${projects.length} project(s) in the VS Code workspace`);
        projects.sort((a, b) => a.name.localeCompare(b.name));
        ExtensionState.getInstance().project.set(...projects);
    });

    ewpWatcher.onFileModified(async modifiedFile => {
        // Reload the project from disk if it is currently loaded
        const extendedProject = await ExtensionState.getInstance().extendedProject.getValue();
        if (extendedProject && OsUtils.pathsEqual(modifiedFile, extendedProject.path)) {
            await ExtensionState.getInstance().reloadProject();
        }

        // Update the project list if necessary (e.g. because the project configurations changed)
        const projectModel = ExtensionState.getInstance().project;
        const oldProject = projectModel.projects.find(
            project => OsUtils.pathsEqual(project.path, modifiedFile)
        );
        const reloadedProject = new EwpFile(modifiedFile);
        if (oldProject && !Project.equal(oldProject, reloadedProject)) {
            const updatedProjects: Project[] = [];
            projectModel.projects.forEach(project => {
                if (project === oldProject) {
                    updatedProjects.push(reloadedProject);
                } else {
                    updatedProjects.push(project);
                }
            });
            // This will load the selected project again (i.e. for the second time if we reloaded it above),
            // but it is probably not noticable to the user.
            projectModel.set(...updatedProjects);
        }
    });

    Settings.observeSetting(Settings.ExtensionSettingsField.ProjectsToExclude, () =>
        ewpWatcher.refreshFiles());
}

async function loadTools(addWorkbenchCommand?: Command<unknown>) {
    IarVsc.workbenchesLoading.next(true);
    const roots = Settings.getIarInstallDirectories();

    await IarVsc.toolManager.collectWorkbenches(roots, true);
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
}
