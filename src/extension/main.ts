/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as vscode from "vscode";
import { ExtensionState } from "./extensionstate";
import { IarToolManager } from "../iar/tools/manager";
import { ExtensionSettings } from "./settings/extensionsettings";
import { IarTaskProvider } from "./task/provider";
import { GetSettingsCommand } from "./command/getsettings";
import { CpptoolsIntellisenseService } from "./intellisense/cpptoolsintellisenseservice";
import { CStatTaskProvider } from "./task/cstat/cstattaskprovider";
import { TreeProjectView } from "./ui/treeprojectview";
import { ReloadProjectCommand } from "./command/project/reloadproject";
import { RemoveNodeCommand } from "./command/project/removenode";
import { AddFileCommand, AddFileToRootCommand, AddGroupCommand, AddGroupToRootCommand } from "./command/project/addnode";
import { SettingsWebview } from "./ui/settingswebview";
import { AddWorkbenchCommand } from "./command/addworkbench";
import { Command } from "./command/command";
import { BuildExtensionApi } from "iar-vsc-common/buildExtension";
import { Project } from "../iar/project/project";
import { logger } from "iar-vsc-common/logger";
import { FileListWatcher } from "./filelistwatcher";
import { API } from "./api";
import { StatusBarItem } from "./ui/statusbaritem";
import { BehaviorSubject } from "rxjs";
import { ToolbarWebview } from "./ui/toolbarview";
import { ToggleCstatToolbarCommand } from "./command/togglecstattoolbar";
import { OsUtils } from "iar-vsc-common/osUtils";
import { EwwFile } from "../iar/workspace/ewwfile";
import { TreeBatchBuildView } from "./ui/batchbuildview";
import { BatchBuild } from "./ui/batchbuildcommands";
import { ErrorUtils } from "../utils/utils";

export function activate(context: vscode.ExtensionContext): BuildExtensionApi {
    logger.init("IAR Build");
    logger.debug("Activating extension");
    IarVsc.extensionContext = context;
    ExtensionState.init(IarVsc.toolManager);

    const workbenchModel = ExtensionState.getInstance().workbenches;
    const workspacesModel = ExtensionState.getInstance().workspaces;
    const workspaceModel = ExtensionState.getInstance().workspace;

    // --- create and register commands
    GetSettingsCommand.initCommands(context);
    new ReloadProjectCommand().register(context);
    new AddFileToRootCommand().register(context);
    new AddGroupToRootCommand().register(context);
    new AddFileCommand().register(context);
    new AddGroupCommand().register(context);
    new RemoveNodeCommand().register(context);
    new ToggleCstatToolbarCommand().register(context);
    const addWorkbenchCmd = new AddWorkbenchCommand(IarVsc.toolManager);
    addWorkbenchCmd.register(context);
    const workbenchCmd = Command.createSelectWorkbenchCommand(workbenchModel);
    workbenchCmd.register(context);
    const workspaceCmd = Command.createSelectWorkspaceCommand(workspacesModel);
    workspaceCmd.register(context);
    const projectCmd = Command.createSelectProjectCommand(workspaceModel);
    projectCmd.register(context);
    const configCmd = Command.createSelectConfigurationCommand(workspaceModel);
    configCmd.register(context);

    // --- initialize custom GUI
    // const projectModel = ExtensionState.getInstance().project;
    // const configModel = ExtensionState.getInstance().config;

    IarVsc.settingsView = new SettingsWebview(context.extensionUri, workbenchModel, workspacesModel, workspaceModel, addWorkbenchCmd, IarVsc.workbenchesLoading);
    vscode.window.registerWebviewViewProvider(SettingsWebview.VIEW_TYPE, IarVsc.settingsView);
    vscode.window.registerWebviewViewProvider(ToolbarWebview.VIEW_TYPE, new ToolbarWebview(context.extensionUri));
    IarVsc.projectTreeView = new TreeProjectView(
        workbenchModel,
        workspaceModel,
    );

    // Batch build
    IarVsc.batchbuildTreeView = new TreeBatchBuildView(
        workbenchModel,
        workspaceModel);
    BatchBuild.Init(context);

    StatusBarItem.createFromModel("iar.workbench", workbenchModel, workbenchCmd, "IAR Toolchain: ", 5);
    StatusBarItem.createFromModel("iar.workspace", workspacesModel, workspaceCmd, "Workspace: ", 4);
    StatusBarItem.createFromWorkspaceModel(
        workspaceModel,
        "iar.project",
        projectCmd,
        "Project: ",
        3,
        "iar.configuration",
        configCmd,
        "Configuration: ",
        2);

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
    ExtensionSettings.observeSetting(ExtensionSettings.ExtensionSettingsField.IarInstallDirectories, () => loadTools());


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
    // Workspaces
    IarVsc.ewwWatcher = await FileListWatcher.initialize("**/*.eww");
    context.subscriptions.push(IarVsc.ewwWatcher);

    IarVsc.ewwWatcher.subscribe(files => {
        const workspaces: EwwFile[] = [];
        files.
            forEach(file => {
                try {
                    workspaces.push(new EwwFile(file));
                } catch (e) {
                    logger.error(`Could not parse workspace file '${file}': ${e}`);
                    vscode.window.showErrorMessage(
                        `Could not parse workspace file '${file}': ${e}`
                    );
                }
            });
        logger.debug(`Found ${workspaces.length} workspace(s) in the VS Code workspace`);
        workspaces.sort((a, b) => a.name.localeCompare(b.name));
        ExtensionState.getInstance().workspaces.set(...workspaces);
    });

    IarVsc.ewwWatcher.onFileModified(async modifiedFile => {
        const workspaceModel = ExtensionState.getInstance().workspaces;
        if (workspaceModel.selected && OsUtils.pathsEqual(workspaceModel.selected?.path, modifiedFile)) {
            await ExtensionState.getInstance().reloadWorkspace();
        }
    });

    // Projects
    IarVsc.ewpWatcher = await FileListWatcher.initialize("**/*.ewp");
    context.subscriptions.push(IarVsc.ewpWatcher);

    IarVsc.ewpWatcher.subscribe(files => {
        const projects = files.filter(file => !Project.isIgnoredFile(file));
        projects.sort();
        if (JSON.stringify(projects) !== JSON.stringify(ExtensionState.getInstance().getFallbackProjects())) {
            logger.debug(`Found ${projects.length} project(s) in the VS Code workspace`);
            ExtensionState.getInstance().setFallbackProjects(projects);
        }
    });

    IarVsc.ewpWatcher.onFileModified(async modifiedFile => {
        const workspace = await ExtensionState.getInstance().workspace.getValue();
        const oldProject = workspace?.projects.projects.find(
            project => OsUtils.pathsEqual(project.path, modifiedFile)
        );
        try {
            await oldProject?.reload();
        } catch (e) {
            const errMsg = ErrorUtils.toErrorMessage(e);
            logger.error(`Failed to reload project '${oldProject?.name}': ${errMsg}`);
            vscode.window.showErrorMessage(`Failed to reload project '${oldProject?.name}': ${errMsg}`);
        }
    });

    ExtensionSettings.observeSetting(ExtensionSettings.ExtensionSettingsField.ProjectsToExclude, () =>
        IarVsc.ewpWatcher?.refreshFiles());
}

async function loadTools(addWorkbenchCommand?: Command<unknown>) {
    IarVsc.workbenchesLoading.next(true);
    const roots = ExtensionSettings.getIarInstallDirectories();

    await IarVsc.toolManager.collectWorkbenches(roots, true);
    if (IarVsc.toolManager.workbenches.length === 0 && addWorkbenchCommand) {
        vscode.window.showErrorMessage(
            "Unable to find any IAR toolchains to use. You must locate one before you can use this extension.",
            "Add IAR toolchain").
            then(response => {
                if (response === "Add IAR toolchain") {
                    vscode.commands.executeCommand(addWorkbenchCommand.id);
                }
            });
    }
    IarVsc.workbenchesLoading.next(false);

}

export namespace IarVsc {
    export let extensionContext: vscode.ExtensionContext | undefined;
    export const toolManager = new IarToolManager();
    export const workbenchesLoading = new BehaviorSubject<boolean>(false);
    export let ewwWatcher: FileListWatcher | undefined;
    export let ewpWatcher: FileListWatcher | undefined;
    // exported mostly for testing purposes
    export let settingsView: SettingsWebview;
    export let projectTreeView: TreeProjectView;
    export let batchbuildTreeView: TreeBatchBuildView;
}
