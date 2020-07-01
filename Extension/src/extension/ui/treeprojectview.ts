/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import { Node, NodeType, Configuration } from "../../iar/thrift/bindings/projectmanager_types";

interface ProjectNode {
    name: string;
    context: string;
}

class FilesNode implements ProjectNode {
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

class ConfigurationNode implements ProjectNode {
    public name: string;
    public context: string;
    constructor(public config: Configuration) {
        this.name = config.name;
        this.context = "configuration";
    }
}

export class TreeProjectView implements Vscode.TreeDataProvider<ProjectNode> {
    private _onDidChangeTreeData = new Vscode.EventEmitter<ProjectNode | undefined>();
    readonly onDidChangeTreeData: Vscode.Event<ProjectNode | undefined> = this._onDidChangeTreeData.event;

    private rootNode: Node | undefined;
    private configs: Configuration[] | undefined;

    private filesNode: ProjectNode;
    private separatorNode: ProjectNode;
    private configsNode: ProjectNode;

    constructor() {
        this.filesNode = { name: "Files", context: "filesroot" };
        this.separatorNode = { name: "", context: "" };
        this.configsNode = { name: "Configurations", context: "configsroot" };
    }


    public setRootNode(rootNode: Node) {
        this.rootNode = rootNode;
        this._onDidChangeTreeData.fire(undefined);
    }

    public setConfigs(configs: Configuration[]) {
        this.configs = configs;
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: ProjectNode): Vscode.TreeItem | Thenable<Vscode.TreeItem> {
        const item = new Vscode.TreeItem(element.name);
        item.contextValue = element.context;
        if (element === this.filesNode || element === this.configsNode) {
            item.collapsibleState = Vscode.TreeItemCollapsibleState.Expanded
        } else if (element === this.separatorNode) {
            item.collapsibleState = Vscode.TreeItemCollapsibleState.None;
        } else if (element instanceof FilesNode){

            item.collapsibleState = element.iarNode.children.length > 0 ? Vscode.TreeItemCollapsibleState.Expanded : Vscode.TreeItemCollapsibleState.None;
            item.description = element.iarNode.path;

            if (element.iarNode.type == NodeType.File) {
                item.iconPath = new Vscode.ThemeIcon("file-code");
                item.tooltip = element.iarNode.name + " - Click to open";
                item.command = { title: "Open in editor", command: "vscode.open", arguments: [Vscode.Uri.file(element.iarNode.path)] };
            }
            if (element.iarNode.type == NodeType.Group) {
                item.contextValue = "group";
            }

        } else if (element instanceof ConfigurationNode) {
            item.collapsibleState = Vscode.TreeItemCollapsibleState.None;
            item.description = element.config.toolchainId.toUpperCase();
            // item.iconPath = new Vscode.ThemeIcon("database");
        }
        return item;
    }

    getChildren(element?: ProjectNode): Vscode.ProviderResult<ProjectNode[]> {
        if (!element) {
            if (this.rootNode || this.configs) {
                return [this.filesNode, this.separatorNode, this.configsNode];
            } else {
                return [];
            }

        } else if (element === this.filesNode) {
            return this.rootNode ? new FilesNode(this.rootNode).getChildren() : [];
        } else if (element === this.separatorNode) {
            return [];
        } else if (element === this.configsNode) {
            return this.configs ? this.configs.map(conf => new ConfigurationNode(conf)) : [];
        } else if (element instanceof FilesNode){
            return element.getChildren();
        } else if (element instanceof ConfigurationNode) {
            return [];
        }
        return [];
    }
}