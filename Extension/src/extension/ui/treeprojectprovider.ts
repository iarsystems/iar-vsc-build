/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import { Node, NodeType } from "../../iar/project/thrift/bindings/projectmanager_types";
import { Config } from "../../iar/project/config";
import { ExtendedProject } from "../../iar/project/project";

// A generic node in this tree
export interface ProjectNode {
    name: string;
    context: string;
}

// A node showing a file or file group i.e. a {@link Node}
export class FilesNode implements ProjectNode {
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

// A node showing a project {@link Configuration}
export class ConfigurationNode implements ProjectNode {
    public name: string;
    public context: string;
    constructor(public config: Config) {
        this.name = config.name;
        this.context = "configuration";
    }
}

/**
 * Provider for a tree of all files/groups in the project, and all configurations in the project.
 * Uses three top-level nodes: filesNode, under which all files are shown, an empty separatorNode,
 * and configsNode under which all configurations are shown.
 */
export class TreeProjectProvider implements Vscode.TreeDataProvider<ProjectNode> {
    private readonly _onDidChangeTreeData = new Vscode.EventEmitter<ProjectNode | undefined>();
    readonly onDidChangeTreeData: Vscode.Event<ProjectNode | undefined> = this._onDidChangeTreeData.event;

    private rootNode: Node | undefined;
    private configs: ReadonlyArray<Config> | undefined;

    private readonly filesNode: ProjectNode;
    private readonly separatorNode: ProjectNode;
    private readonly configsNode: ProjectNode;

    constructor() {
        this.filesNode = { name: "Files", context: "filesroot" };
        this.separatorNode = { name: "", context: "" };
        this.configsNode = { name: "Configurations", context: "configsroot" };
    }

    public async setProject(project: ExtendedProject | undefined) {
        if (project) {
            await this.updateData(project);
            project.onChanged(() => this.updateData(project));
        } else {
            this.rootNode = undefined;
            this.configs = undefined;
            this._onDidChangeTreeData.fire(undefined);
        }
    }
    /// overriden functions, create the actual tree

    getTreeItem(element: ProjectNode): Vscode.TreeItem | Thenable<Vscode.TreeItem> {
        const item = new Vscode.TreeItem(element.name);
        item.contextValue = element.context;
        if (element === this.filesNode || element === this.configsNode) {
            item.collapsibleState = Vscode.TreeItemCollapsibleState.Expanded;
        } else if (element === this.separatorNode) {
            item.collapsibleState = Vscode.TreeItemCollapsibleState.None;
        } else if (element instanceof FilesNode) {

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

        } else if (element instanceof ConfigurationNode) {
            item.collapsibleState = Vscode.TreeItemCollapsibleState.None;
            item.description = element.config.toolchainId.toUpperCase();
            item.iconPath = new Vscode.ThemeIcon("package");
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
        } else if (element instanceof FilesNode) {
            return element.getChildren();
        } else if (element instanceof ConfigurationNode) {
            return [];
        }
        return [];
    }

    private async updateData(project: ExtendedProject) {
        this.configs = project.configurations;
        this.rootNode = await project.getRootNode();
        this._onDidChangeTreeData.fire(undefined);
    }

}