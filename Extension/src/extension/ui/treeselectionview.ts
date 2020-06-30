/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import { ListInputModel } from "../model/model";
import { Workbench } from "../../iar/tools/workbench";
import { Compiler } from "../../iar/tools/compiler";
import { Project } from "../../iar/project/project";
import { Config } from "../../iar/project/config";

class TreeNode extends Vscode.TreeItem {
    constructor(
        name: string,
        collapsibleState: Vscode.TreeItemCollapsibleState = Vscode.TreeItemCollapsibleState.None,
        tooltip?: string,
        command?: Vscode.Command) {
            super(name, collapsibleState);
            this.tooltip = tooltip;
            this.command = command;
        }
}

/**
 * A top node in the tree, i.e. one of the four types of settings.
 */
class TreeTopNode extends TreeNode {
    constructor(
        name: string,
        collapsibleState: Vscode.TreeItemCollapsibleState = Vscode.TreeItemCollapsibleState.Expanded,
        public readonly commandToSet: string,
        public readonly model: ListInputModel<Workbench | Compiler | Project | Config>,
        tooltip?: string,) {
            super(name, collapsibleState, tooltip)
    }
}

/**
 * Defines a tree view that lists all available options for the plugin
 * settings (workbench, compiler, project, configuration) and allows to
 * set each setting by pressing on an option.
 */
export class TreeSelectionView implements Vscode.TreeDataProvider<TreeNode> {
    private _onDidChangeTreeData = new Vscode.EventEmitter<TreeNode | undefined>();
    readonly onDidChangeTreeData: Vscode.Event<TreeNode | undefined> = this._onDidChangeTreeData.event;

    private readonly topNodes: TreeTopNode[] = [];

    constructor (
        context: Vscode.ExtensionContext,
        workbenchModel: ListInputModel<Workbench>,
        compilerModel: ListInputModel<Compiler>,
        projectModel: ListInputModel<Project>,
        configModel: ListInputModel<Config>,
    ) {
        this.topNodes = [
            new TreeTopNode("EW Installation", Vscode.TreeItemCollapsibleState.Expanded, "setWorkbench", workbenchModel, "Select EW installation"),
            new TreeTopNode("Compiler", Vscode.TreeItemCollapsibleState.Expanded, "setCompiler", compilerModel, "Select compiler"),
            new TreeTopNode("Project", Vscode.TreeItemCollapsibleState.Expanded, "setProject", projectModel, "Select project"),
            new TreeTopNode("Configuration", Vscode.TreeItemCollapsibleState.Expanded, "setConfig", configModel, "Select build configuration"),
        ];
        this.topNodes.forEach(node => {
            node.model.addOnSelectedHandler(() => { this._onDidChangeTreeData.fire(node); });
            node.model.addOnInvalidateHandler(() => { this._onDidChangeTreeData.fire(node); });
            context.subscriptions.push(Vscode.commands.registerCommand(node.commandToSet, (indexToSet: number) => {
                node.model.select(indexToSet);
            }));
        });
    }

    getTreeItem(element: TreeNode): Vscode.TreeItem | Thenable<Vscode.TreeItem> {
        return element;
    }
    getChildren(element?: TreeNode): Vscode.ProviderResult<TreeNode[]> {
        if (element) {
            if (element instanceof TreeTopNode) {
                const model = element.model;
                const children: TreeNode[] = [];
                for (let i = 0; i < model.amount; i++) {
                    children.push(new TreeNode(
                        model.label(i) + (model.selectedIndex == i ? " (selected)" : ""),
                        Vscode.TreeItemCollapsibleState.None,
                        model.description(i),
                        { command: element.commandToSet, arguments: [i], title: "" },
                    ));
                }
                return children;
            } else {
                return [];
            }
        }
        return this.topNodes;
    }
}