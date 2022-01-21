/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import { Node, NodeType } from "../../iar/project/thrift/bindings/projectmanager_types";
import { ExtendedProject } from "../../iar/project/project";

// A node showing a file or file group i.e. a {@link Node}
export class FilesNode {
    public name: string;
    public context: string;
    constructor(public iarNode: Node) {
        this.name = iarNode.name;
        this.context = iarNode.type === NodeType.File ? "file" : "group";
    }

    getChildren(): FilesNode[] {
        return this.iarNode.children.map(child => new FilesNode(child));
    }
}

/**
 * Provider for a tree of all files/groups in the project.
 */
export class TreeProjectProvider implements Vscode.TreeDataProvider<FilesNode> {
    private readonly _onDidChangeTreeData = new Vscode.EventEmitter<FilesNode | undefined>();
    readonly onDidChangeTreeData: Vscode.Event<FilesNode | undefined> = this._onDidChangeTreeData.event;

    private rootNode: Node | undefined;

    public async setProject(project: ExtendedProject | undefined) {
        if (project) {
            await this.updateData(project);
            project.onChanged(() => this.updateData(project));
        } else {
            this.rootNode = undefined;
            this._onDidChangeTreeData.fire(undefined);
        }
    }

    /// overriden functions, create the actual tree

    getTreeItem(element: FilesNode): Vscode.TreeItem | Thenable<Vscode.TreeItem> {
        const item = new Vscode.TreeItem(element.name);
        item.contextValue = element.context;
        item.collapsibleState = element.iarNode.children.length > 0 ? Vscode.TreeItemCollapsibleState.Expanded : Vscode.TreeItemCollapsibleState.None;

        if (element.iarNode.type === NodeType.File) {
            item.tooltip = element.iarNode.path;
            item.command = { title: "Open in editor", command: "vscode.open", arguments: [Vscode.Uri.file(element.iarNode.path)] };
            item.resourceUri = Vscode.Uri.file(element.iarNode.path);
        }
        if (element.iarNode.type === NodeType.Group) {
            item.iconPath = new Vscode.ThemeIcon("folder");
            item.contextValue = "group";
        }

        return item;
    }

    getChildren(element?: FilesNode): Vscode.ProviderResult<FilesNode[]> {
        if (!element) {
            return this.rootNode ? new FilesNode(this.rootNode).getChildren() : [];
        } else if (element instanceof FilesNode) {
            return element.getChildren();
        }
        return [];
    }

    private async updateData(project: ExtendedProject) {
        this.rootNode = await project.getRootNode();
        this._onDidChangeTreeData.fire(undefined);
    }

}