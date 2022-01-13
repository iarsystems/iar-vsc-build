/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import { ExtendedProject } from "../../iar/project/project";
import { TreeProjectProvider, ProjectNode } from "./treeprojectprovider";
import { Workbench } from "../../iar/tools/workbench";
import { ExtendedWorkbench } from "../../iar/extendedworkbench";
import { SingletonModel } from "../model/singletonmodel";
import { InputModel } from "../model/model";

/**
 * Shows a view to the left of all files/groups in the project, and all configurations in the project.
 * This view requires an ExtendedProject, and will show an appropriate message when no such project is available.
 */
export class TreeProjectView {
    private readonly provider: TreeProjectProvider = new TreeProjectProvider();
    private readonly view: Vscode.TreeView<ProjectNode>;
    private hasExtendedWorkbench = false;
    private isLoading = false;

    constructor(loadingModel: SingletonModel<boolean>,
        extProjectModel: SingletonModel<ExtendedProject>,
        private readonly workbenchModel: InputModel<Workbench>,
        extWorkbenchModel: SingletonModel<ExtendedWorkbench>) {

        this.view = Vscode.window.createTreeView("iar-project", { treeDataProvider: this.provider });
        this.view.title = "IAR Project";
        loadingModel.addOnValueChangeHandler(isLoading => {
            this.isLoading = isLoading === true;
            this.updateMessage();
            if (isLoading) {
                this.provider.setProject(undefined);
            }
        });
        extProjectModel.addOnValueChangeHandler(project => {
            this.view.description = project?.name;
            this.provider.setProject(project);
        });
        extWorkbenchModel.addOnValueChangeHandler(extWorkbench => {
            this.hasExtendedWorkbench = extWorkbench !== undefined;
            this.updateMessage();
        });
    }

    private updateMessage() {
        if (this.isLoading) {
            if (this.hasExtendedWorkbench) {
                this.view.message = "Loading...";
            }
        } else {
            if (!this.hasExtendedWorkbench && this.workbenchModel.selected) {
                this.view.message = "A newer workbench version is required to see and manage project contents.";
            } else {
                this.view.message = undefined;
            }
        }
    }

    /**
     *! Only exposed for testing!
     */
    get _provider() {
        return this.provider;
    }
}