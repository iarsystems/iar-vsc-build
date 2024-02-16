/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import { BatchBuildNode, TreeBatchBuildProvider } from "./treebatchbuildprovider";
import { AsyncObservable } from "../../utils/asyncobservable";
import { WorkbenchFeatures} from "iar-vsc-common/workbenchfeatureregistry";
import { EwWorkspace } from "../../iar/workspace/ewworkspace";
import { InputModel } from "../model/model";
import { Workbench } from "iar-vsc-common/workbench";

/**
 * Shows a view to the left of all the defined batch-builds with corresponding project-configuration pairs.
 */
export class TreeBatchBuildView {
    private readonly provider: TreeBatchBuildProvider = new TreeBatchBuildProvider();
    private readonly view: Vscode.TreeView<BatchBuildNode>;

    constructor(
        workbenchModel: InputModel<Workbench>,
        workspaceModel: AsyncObservable<EwWorkspace>) {

        this.view = Vscode.window.createTreeView("iar-batchbuild", { treeDataProvider: this.provider, showCollapseAll: true, dragAndDropController: this.provider });

        let isLoading = false;
        let isEmpty = false;
        let hasWorkspace = false;
        let saveAvailable = false;
        let oldWorkbench = false;
        const updateMessage = () => {
            if (isLoading) {
                this.view.message = "Loading...";
            } else if (hasWorkspace && (!saveAvailable || oldWorkbench)) {
                this.view.message = (oldWorkbench? "Selected toolchain does not support modifying workspaces" : "No workspace specified") + ": Batches are not persistent between sessions";
            } else if (hasWorkspace && isEmpty) {
                this.view.message = "There are no batch builds in the workspace. To add one, press the '+' button.";
            } else {
                this.view.message = undefined;
            }
        };

        workspaceModel.onValueWillChange(() => {
            isLoading = true;
            updateMessage();
        });
        workspaceModel.onValueDidChange(workspace => {
            hasWorkspace = workspace !== undefined;
            saveAvailable = !!(workspace?.isExtendedWorkspace() && workspace?.path !== undefined);
            isLoading = false;
            this.provider.setWorkspace(workspace);
            updateMessage();
        });
        workbenchModel.addOnSelectedHandler(() => {
            oldWorkbench = false;
            if (workbenchModel.selected) {
                oldWorkbench = !WorkbenchFeatures.supportsFeature(workbenchModel.selected, WorkbenchFeatures.PMWorkspaces);
            }
            updateMessage();
        });
        this.provider.isEmpty.subscribe(empty => {
            isEmpty = empty;
            updateMessage();
        });
    }

    // Allow external commands to force an update based on the information in the underlying provider.
    public refresh(): void {
        this.provider.update();
    }

    // Synchronize the current state of the tree with the backend by writing the current state
    // of the tree to the backend before updating the tree based on the current state of the backend.
    public syncWithBackend(): void {
        this.provider.syncWithBackend();
    }

    /**
     *! Only exposed for testing!
     */
    get _provider() {
        return this.provider;
    }
}