/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import { ExtendedProject, Project } from "../../iar/project/project";
import { FilesNode, TreeProjectProvider } from "./treeprojectprovider";
import { Workbench } from "../../iar/tools/workbench";
import { ExtendedWorkbench } from "../../iar/extendedworkbench";
import { InputModel } from "../model/model";
import { AsyncObservable } from "../model/asyncobservable";
import { Subject } from "rxjs";

/**
 * Shows a view to the left of all files/groups in the project, and all configurations in the project.
 * This view requires an ExtendedProject, and will show an appropriate message when no such project is available.
 */
export class TreeProjectView {
    private readonly provider: TreeProjectProvider = new TreeProjectProvider();
    private readonly view: Vscode.TreeView<FilesNode>;

    constructor(projectModel: InputModel<Project>,
        extProjectModel: AsyncObservable<ExtendedProject>,
        workbenchModel: InputModel<Workbench>,
        extWorkbenchModel: AsyncObservable<ExtendedWorkbench>,
        loading: Subject<boolean>) {

        this.view = Vscode.window.createTreeView("iar-project", { treeDataProvider: this.provider, showCollapseAll: true });
        this.view.description = projectModel.selected?.name;

        projectModel.addOnSelectedHandler((_, project) => {
            this.view.description = project?.name;
        });

        let isLoading = false;
        let hasExtendedWb = false;
        let projectIsEmpty = false;
        const updateMessage = () => {
            if (isLoading) {
                this.view.message = "Loading...";
            } else {
                if (!hasExtendedWb && workbenchModel.selected) {
                    this.view.message = "This IAR Embedded Workbench does not support editing projects from VS Code.";
                } else {
                    if (projectIsEmpty) {
                        this.view.message = "There are no files in the project";
                    } else {
                        this.view.message = undefined;
                    }
                }
            }
        };

        loading.subscribe(load => {
            isLoading = load;
            updateMessage();
            this.provider.setProject(undefined);
        });
        extProjectModel.onValueDidChange(project => {
            this.provider.setProject(project).then(() => {
                updateMessage();
                // Enable/disable the 'add file/group' buttons on this view
                Vscode.commands.executeCommand("setContext", "iarvsc.extendedProjectLoaded", project !== undefined);
            });
        });
        extWorkbenchModel.onValueDidChange(extWorkbench => {
            hasExtendedWb = extWorkbench !== undefined;
            updateMessage();
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