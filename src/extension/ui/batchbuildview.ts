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

/** Simplified placeholder to allow batchbuilds for non-existant eww-file projects.*/
class EwwPlaceHolder extends EwWorkspaceBase {
    readonly path: string = "";
    readonly projects: string[] = [];
    private batchItems: BatchBuildItem[] = [];

    constructor() {
        super();
    }

    override getBatchBuilds(): Promise<BatchBuildItem[] | undefined> {
        return new Promise(() => {
            return this.batchItems;
        });
    }

    override setBatchBuilds(items: BatchBuildItem[]): Promise<BatchBuildItem[] | undefined> {
        this.batchItems = items;
        return this.getBatchBuilds();
    }
}


/**
 * Shows a view to the left of all files/groups in the project, and all configurations in the project.
 * This view requires an ExtendedProject, and will show an appropriate message when no such project is available.
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
        const updateMessage = () => {
            if (isLoading) {
                this.view.message = "Loading...";
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
            this.provider.setWorkspace(workspace?? new EwwPlaceHolder());
            isLoading = false;
            updateMessage();
        });
        extWorkbenchModel.onValueDidChange(_extWorkbench => {
            isLoading = true;
            updateMessage();
        });
        this.provider.isEmpty.subscribe(_isEmpty => {
            updateMessage();
        });
    }

    // Allow external commands to force an update based on the information in the underlying provider.
    public Refresh(): void {
        this.provider.Update();
    }

    // Synchronize the current state of the tree with the backend by writing the current state
    // of the tree to the backend before updating the tree based on the current state of the backend.
    public SyncWithBackend(): void {
        this.provider.SyncWithBackend();
    }

    /**
     *! Only exposed for testing!
     */
    get _provider() {
        return this.provider;
    }
}