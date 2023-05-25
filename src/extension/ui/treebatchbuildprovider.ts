/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import { BehaviorSubject } from "rxjs";
import { BatchBuildItem, BuildItem, ProjectContext } from "iar-vsc-common/thrift/bindings/projectmanager_types";
import path = require("path");
import { EwWorkspace } from "../../iar/workspace/ewworkspace";


export enum NodeType {
    BuildItem,
    BatchBuildItem
}

// A node showing a BatchBuild item, which is basically a named container for
// a set of project-configuration pair that should be built.
export class BatchBuildNode {
    public type: NodeType = NodeType.BatchBuildItem;

    constructor(public name: string, type: NodeType, public parent: BatchBuildNode | undefined, public children: BatchBuildNode[]) {
        this.type = type;
    }

    /*
    * Convert the node into the thrift model for a batchbuild item.
    */
    asBatchBuildItem(): BatchBuildItem {
        const batchItem: BatchBuildItem = new BatchBuildItem({ name: this.name, buildItems: [] });
        for (const child of this.children) {
            if (child instanceof BatchBuildItemNode) {
                batchItem.buildItems.push(child.asBuildItem());
            }
        }
        return batchItem;
    }

}

// A node representing the project-configuration pair in a batch build sequence.
export class BatchBuildItemNode extends BatchBuildNode {
    constructor(parent: BatchBuildNode, public project: string, public configurationName: string) {
        super(path.basename(project, ".ewp") + " - " + configurationName, NodeType.BuildItem, parent, []);
    }

    asBuildItem(): BuildItem {
        const context: ProjectContext = new ProjectContext({ filename: this.project });
        return new BuildItem({ projectContext: context, configurationName: this.configurationName, nodePaths: [] });
    }
}

// The information taht is packed when transmitting a drag-n-drop to resort the BatchBuildItemNodes.
export interface BatchNodeDragInfo {
    readonly name: string,
    readonly index: number
}


export class TreeBatchBuildProvider implements Vscode.TreeDataProvider<BatchBuildNode>, Vscode.TreeDragAndDropController<BatchBuildNode> {
    // The tree only deals with it's own type for drag-n-drop.
    readonly mimeType: string = "application/vnd.code.tree.iar-batchbuild";
    dropMimeTypes: readonly string[] = [this.mimeType];
    dragMimeTypes: readonly string[] = [this.mimeType];

    readonly isEmpty = new BehaviorSubject<boolean>(false);

    private readonly _onDidChangeTreeData = new Vscode.EventEmitter<BatchBuildNode | undefined>();
    readonly onDidChangeTreeData: Vscode.Event<BatchBuildNode | undefined> = this._onDidChangeTreeData.event;

    // This is the root node of the tree. It should NEVER be removed and is the only node that has "undefined" as parent.
    readonly rootNode: BatchBuildNode = new BatchBuildNode("root", NodeType.BatchBuildItem, undefined, []);
    workspace: EwWorkspace | undefined;

    // The icons used by the tree.
    private readonly batchLight: string = path.join(__filename, "../../../../media/icons/Batch-light.svg");
    private readonly batchDark: string = path.join(__filename, "../../../../media/icons/Batch-dark.svg");

    // Handler for packaging the drag item.
    handleDrag?(source: readonly BatchBuildNode[], dataTransfer: Vscode.DataTransfer, _token: Vscode.CancellationToken): void | Thenable<void> {
        const items: BatchNodeDragInfo[] = [];

        for (const item of source) {
            if (!item.parent) {
                continue;
            }
            const _index: number = item.parent.children.indexOf(item, 0);
            const newData: BatchNodeDragInfo = {
                index: _index,
                name: item.parent.name
            };
            items.push(newData);
        }

        dataTransfer.set(this.mimeType, new Vscode.DataTransferItem(items));

    }

    // Drop handler: Moving a build item up places it above the targeted node, moving down places it below. Note that the tree does not support
    // multiselection we only need to address the first element in the transfered list.
    handleDrop?(target: BatchBuildNode | undefined, dataTransfer: Vscode.DataTransfer, _token: Vscode.CancellationToken): void | Thenable<void> {
        if (target === undefined || !target.parent) {
            return;
        }

        // Assure that the data is correct.
        const item = dataTransfer.get(this.mimeType);
        if (!item) {
            return;
        }

        const itemData: BatchNodeDragInfo[] = item.value;
        // Assert that the parents are the same.
        if (target.parent.name !== itemData[0]?.name) {
            return;
        }

        // Find the index of the place we're sorting to.
        const targetIndex: number = target.parent.children.indexOf(target);
        const nodeToMove: BatchBuildNode | undefined = target.parent.children[itemData[0].index];

        if (nodeToMove === undefined) {
            return;
        }

        if (targetIndex < itemData[0].index) {
            // Moving the node up -> place the node above target
            target.parent.children.splice(targetIndex, 0, nodeToMove);
            target.parent.children.splice(itemData[0].index + 1, 1);
        } else {
            // Moving the node down -> place the node below the target.
            if (targetIndex === target.parent.children.length - 1) {
                // Some special handling is required when dealing with the last element.
                target.parent.children.push(nodeToMove);
            } else {
                target.parent.children.splice(targetIndex + 1, 0, nodeToMove);
            }
            target.parent.children.splice(itemData[0].index, 1);
        }

        // Finish of by forcing an update of the tree content.
        this.Update();
    }

    public async setWorkspace(workspace: EwWorkspace | undefined) {
        this.workspace = workspace;

        const batches: BatchBuildItem[] = [];
        if (workspace !== undefined) {
            const workspaceBatches = await workspace.getBatchBuilds();

            if (workspaceBatches !== undefined) {
                batches.push(...workspaceBatches);
            }
        }

        this.unpackData(batches);
        this.Update();
    }



    // Exposed API to allow commands to fire updates.
    public Update(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    // Used by VsCode to draw the actul tree based on the information stored in the tree.
    getTreeItem(element: BatchBuildNode): Vscode.TreeItem | Thenable<Vscode.TreeItem> {
        const item = new Vscode.TreeItem(element.name);

        if (element.type === NodeType.BatchBuildItem) {
            item.iconPath = { light: this.batchLight, dark: this.batchDark };
            item.contextValue = "batchitem";
        }
        if (element.type === NodeType.BuildItem) {
            item.iconPath = undefined;
            item.contextValue = "builditem";
        }

        if (element.children.length === 0) {
            item.collapsibleState = Vscode.TreeItemCollapsibleState.None;
        } else {
            if (element.type === NodeType.BuildItem) {
                item.collapsibleState = Vscode.TreeItemCollapsibleState.Collapsed;
            } else {
                item.collapsibleState = Vscode.TreeItemCollapsibleState.Expanded;
            }
        }

        return item;
    }

    // Called by Vscode when trying to build the tree, starting with root.
    getChildren(element?: BatchBuildNode): Vscode.ProviderResult<BatchBuildNode[]> {
        if (!element) {
            return this.rootNode ? this.rootNode.children : [];
        } else if (element instanceof BatchBuildNode) {
            return element.children;
        }
        return [];
    }

    // This method will sync the current state of the tree to the backend
    // before reloading the tree with the state of the backend.
    public async SyncWithBackend() {
        const toSync: BatchBuildItem[] = [];
        for (const batchItem of this.rootNode.children) {
            toSync.push(batchItem.asBatchBuildItem());
        }

        const syncResults = await this.workspace?.setBatchBuilds(toSync);
        this.unpackData(syncResults);
    }

    // This method unpacks the thrift BatchBuildItems into the tree view. Should
    // be followed by a call to Update to redraw the tree.
    unpackData(items: BatchBuildItem[] | undefined) {
        this.rootNode.children = [];

        if (items === undefined) {
            return;
        }

        for (const item of items) {
            const itemRoot: BatchBuildNode = new BatchBuildNode(item.name, NodeType.BatchBuildItem, this.rootNode, []);

            for (const buildItem of item.buildItems) {
                itemRoot.children.push(new BatchBuildItemNode(itemRoot, buildItem.projectContext.filename, buildItem.configurationName));
            }

            this.rootNode.children.push(itemRoot);
        }
    }

}