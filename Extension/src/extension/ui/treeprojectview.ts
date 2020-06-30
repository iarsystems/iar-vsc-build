/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import { Node, NodeType } from "../../iar/thrift/bindings/projectmanager_types";

class TreeNode extends Vscode.TreeItem {
    constructor(
        public iarNode: Node,
        collapsibleState: Vscode.TreeItemCollapsibleState = Vscode.TreeItemCollapsibleState.None,
        command?: Vscode.Command) {
            super(iarNode.name, collapsibleState);
            this.tooltip = "Click to open";
            this.command = command;
            this.iconPath = iarNode.type == NodeType.File ? new Vscode.ThemeIcon("file-code") : undefined;
        }
}

// TODO: make sure to open a file when clicked
export class TreeProjectView implements Vscode.TreeDataProvider<TreeNode> {
    private _onDidChangeTreeData = new Vscode.EventEmitter<TreeNode | undefined>();
    readonly onDidChangeTreeData: Vscode.Event<TreeNode | undefined> = this._onDidChangeTreeData.event;

    private rootNode: Node | undefined;


    public setRootNode(rootNode: Node) {
        this.rootNode = rootNode;
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: TreeNode): Vscode.TreeItem | Thenable<Vscode.TreeItem> {
        return element;
    }

    getChildren(element?: TreeNode): Vscode.ProviderResult<TreeNode[]> {
        const node = element ? element.iarNode : this.rootNode;
        if (!node) { return []; }
        return node.children.map(n => {
            const collapsibleState = n.type === NodeType.Group ? Vscode.TreeItemCollapsibleState.Expanded : Vscode.TreeItemCollapsibleState.None;
            const command = n.type === NodeType.File ? { title: "Open in editor", command: "vscode.open", arguments: [Vscode.Uri.file(n.path)] } : undefined;
            return new TreeNode(n, collapsibleState, command);
        });
    }
}