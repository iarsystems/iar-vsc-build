/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import { BatchBuildNode, TreeBatchBuildProvider } from "./treebatchbuildprovider";
import { ExtendedWorkbench } from "../../iar/extendedworkbench";
import { AsyncObservable } from "../../utils/asyncobservable";
import { Subject } from "rxjs";
import { EwWorkspaceBase, ExtendedEwWorkspace } from "../../iar/workspace/ewworkspace";
import { BatchBuildItem } from "iar-vsc-common/thrift/bindings/projectmanager_types";
import { WorkbenchFeatures} from "iar-vsc-common/workbenchfeatureregistry";

/** Simplified placeholder to allow batchbuilds for non-existant eww-file projects.*/
class EwwPlaceHolder extends EwWorkspaceBase {
    readonly path: string = "";
    readonly projects: string[] = [];
    private batchItems: BatchBuildItem[] = [];

    constructor() {
        super();
    }

    override getBatchBuilds(): Promise<BatchBuildItem[] | undefined> {
        return Promise.resolve(this.batchItems);
    }

    override setBatchBuilds(items: BatchBuildItem[]): Promise<BatchBuildItem[] | undefined> {
        this.batchItems = items;
        return this.getBatchBuilds();
    }
}


/**
 * Shows a view to the left of all the defined batch-builds with corresponding project-configuration pairs.
 */
export class TreeBatchBuildView {
    private readonly provider: TreeBatchBuildProvider = new TreeBatchBuildProvider();
    private readonly view: Vscode.TreeView<BatchBuildNode>;

    constructor(
        workspaceModel: AsyncObservable<ExtendedEwWorkspace>,
        extWorkbenchModel: AsyncObservable<ExtendedWorkbench>,
        loading: Subject<boolean>) {

        this.view = Vscode.window.createTreeView("iar-batchbuild", { treeDataProvider: this.provider, showCollapseAll: true, dragAndDropController: this.provider });

        let isLoading = false;
        let saveAvailable = false;
        let oldWorkbench = false;
        const updateMessage = () => {
            if (isLoading) {
                this.view.message = "Loading...";
            } else if (!isLoading && (!saveAvailable || oldWorkbench)) {
                this.view.message = (oldWorkbench? "Selected toolchain does not support modifying workspaces" : "No workspace specified") + ": Batches are not persisted between sessions";
            } else {
                this.view.message = undefined;
            }
        };

        loading.subscribe(load => {
            if (load) {
                isLoading = load;
                updateMessage();
            }
        });
        workspaceModel.onValueDidChange(workspace => {
            saveAvailable = workspace !== undefined;
            this.provider.setWorkspace(workspace?? new EwwPlaceHolder());
            isLoading = false;
            updateMessage();
        });
        extWorkbenchModel.onValueDidChange(extWorkbench => {
            oldWorkbench = false;
            if (extWorkbench) {
                oldWorkbench = !WorkbenchFeatures.supportsFeature(extWorkbench.workbench, WorkbenchFeatures.ThriftPM);
            }
            isLoading = true;
            updateMessage();
        });
        this.provider.isEmpty.subscribe(_isEmpty => {
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