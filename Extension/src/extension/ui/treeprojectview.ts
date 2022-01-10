/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import { ExtendedProject, Project } from "../../iar/project/project";
import { InputModel } from "../model/model";
import { TreeProjectProvider, ProjectNode } from "./treeprojectprovider";
import { Workbench } from "../../iar/tools/workbench";
import { ExtendedWorkbench } from "../../iar/extendedworkbench";

/**
 * Shows a view to the left of all files/groups in the project, and all configurations in the project.
 * This view requires an ExtendedProject, and will show an appropriate message when no such project is available.
 */
export class TreeProjectView {
    private readonly provider: TreeProjectProvider = new TreeProjectProvider();
    private readonly view: Vscode.TreeView<ProjectNode>;

    constructor(projectModel: InputModel<Project>,
        extProjectModel: InputModel<ExtendedProject>,
        workbenchModel: InputModel<Workbench>,
        extWorkbenchModel: InputModel<ExtendedWorkbench>) {
        this.view = Vscode.window.createTreeView("iar-project", { treeDataProvider: this.provider });
        projectModel.addOnSelectedHandler((_model, project) => {
            this.view.title =  "IAR Project" + (project ? ": " + project.name : "");
        });
        extProjectModel.addOnSelectedHandler((_model, project) => {
            this.provider.setProject(project);
        });
        extWorkbenchModel.addOnSelectedHandler((_model, extWorkbench) => {
            if (extWorkbench || !workbenchModel.selected) {
                // no message - show welcome content from package.json if no project is loaded
                this.view.message = undefined;
            } else {
                // Workbench loaded but no extended workbench means we can't manage/create projects, so tell the user that
                this.view.message = "A newer workbench version is required to see and manage project contents.";
            }
        });
    }

    /**
     *! Only exposed for testing!
     */
    get _provider() {
        return this.provider;
    }
}