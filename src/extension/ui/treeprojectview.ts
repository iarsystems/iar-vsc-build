/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import { FilesNode, TreeProjectProvider } from "./treeprojectprovider";
import { Workbench } from "iar-vsc-common/workbench";
import { InputModel } from "../model/model";
import { AsyncObservable } from "../../utils/asyncobservable";
import { WorkbenchFeatures } from "iar-vsc-common/workbenchfeatureregistry";
import { EwWorkspace } from "../../iar/workspace/ewworkspace";

/**
 * Shows a view to the left of all files/groups in the project, and all configurations in the project.
 * This view requires an ExtendedProject, and will show an appropriate message when no such project is available.
 */
export class TreeProjectView {
    private readonly provider: TreeProjectProvider = new TreeProjectProvider();
    private readonly view: Vscode.TreeView<FilesNode>;

    constructor(workbenchModel: InputModel<Workbench>,
        workspaceModel: AsyncObservable<EwWorkspace>) {

        this.view = Vscode.window.createTreeView("iar-project", { treeDataProvider: this.provider, showCollapseAll: true });

        let isLoading = false;
        let hasProject = false;
        let hasExtendedProject = false;
        let projectIsEmpty = false;
        const updateMessage = () => {
            if (isLoading) {
                this.view.message = "Loading...";
            } else if (hasProject && !hasExtendedProject && workbenchModel.selected !== undefined) {
                if (!WorkbenchFeatures.supportsFeature(workbenchModel.selected, WorkbenchFeatures.ThriftPM)) {
                    // The workbench is too old to support the files view.
                    // Try to display the minimum product version required to see it.
                    const minProductVersion = WorkbenchFeatures.getMinProductVersions(workbenchModel.selected, WorkbenchFeatures.ThriftPM).join(", ");
                    if (minProductVersion) {
                        this.view.message = `The IAR project view requires ${minProductVersion} or later.`;
                    } else {
                        this.view.message = "This IAR toolchain does not support modifying projects from VS Code.";
                    }
                } else {
                    // The workbench *should* support this view but doesn't. The project manager probably crashed.
                    this.view.message = "The IAR project view is unavailable. See the extension logs for more information.";
                }
            } else if (hasProject && projectIsEmpty) {
                this.view.message = "There are no files in the project";
            } else {
                this.view.message = undefined;
            }
        };

        workspaceModel.onValueWillChange(() => {
            isLoading = true;
            updateMessage();
            this.provider.setProjectAndConfig(undefined, undefined);
        });
        workspaceModel.onValueDidChange(workspace => {
            hasExtendedProject = workspace?.isExtendedWorkspace() ?? false;

            if (workspace) {
                workspace.projects.addOnSelectedHandler(async() => {
                    this.view.description = workspace.projects.selected?.name;
                    if (workspace.isExtendedWorkspace()) {
                        isLoading = true;
                        updateMessage();
                        const project = await workspace.getExtendedProject();
                        const config = workspace.getActiveConfig();
                        await this.provider.setProjectAndConfig(project, config);
                        hasExtendedProject = !!project;
                        // Enable/disable the 'add file/group' buttons on this view
                        Vscode.commands.executeCommand(
                            "setContext", "iar-build.canModifyProjectTree",
                            project !== undefined && !config?.isControlFileManaged);
                    } else {
                        hasExtendedProject = false;
                    }
                    hasProject = !!workspace.projects.selected;
                    isLoading = false;
                    updateMessage();
                });
                workspace.onActiveConfigChanged((project, config) => {
                    if (config && this.provider.isActiveProject(project)) {
                        this.provider.setProjectConfig(config);
                    }
                });
            } else {
                hasExtendedProject = false;
                this.view.description = undefined;
                isLoading = false;
                hasProject = false;
                updateMessage();
            }
        });

        this.provider.isEmpty.subscribe(isEmpty => {
            projectIsEmpty = isEmpty;
            updateMessage();
        });
    }

    /**
     *! Only exposed for testing!
     */
    get _provider() {
        return this.provider;
    }
}