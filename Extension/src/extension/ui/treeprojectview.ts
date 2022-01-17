/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import { ExtendedProject, Project } from "../../iar/project/project";
import { TreeProjectProvider, ProjectNode } from "./treeprojectprovider";
import { Workbench } from "../../iar/tools/workbench";
import { ExtendedWorkbench } from "../../iar/extendedworkbench";
import { InputModel } from "../model/model";
import { AsyncObservable } from "../model/asyncobservable";

/**
 * Shows a view to the left of all files/groups in the project, and all configurations in the project.
 * This view requires an ExtendedProject, and will show an appropriate message when no such project is available.
 */
export class TreeProjectView {
    private readonly provider: TreeProjectProvider = new TreeProjectProvider();
    private readonly view: Vscode.TreeView<ProjectNode>;

    constructor(projectModel: InputModel<Project>,
        extProjectModel: AsyncObservable<ExtendedProject>,
        workbenchModel: InputModel<Workbench>,
        extWorkbenchModel: AsyncObservable<ExtendedWorkbench>) {

        this.view = Vscode.window.createTreeView("iar-project", { treeDataProvider: this.provider });
        this.view.title = "IAR Project";
        this.view.description = projectModel.selected?.name;

        projectModel.addOnSelectedHandler((_, project) => {
            this.view.description = project?.name;
        });
        extProjectModel.onValueWillChange(() => {
            this.view.message = "Loading...";
            this.provider.setProject(undefined);
        });
        extProjectModel.onValueDidChange(project => {
            this.provider.setProject(project).then(() => {
                this.view.message = undefined;
            });
        });
        extWorkbenchModel.onValueWillChange(() => {
            this.view.message = "Loading...";
        });
        extWorkbenchModel.onValueDidChange(extWorkbench => {
            if (!extWorkbench && workbenchModel.selected) {
                this.view.message = "This Embedded Workbench does not support editing projects from VS Code.";
            } else {
                this.view.message = "Loading...";
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