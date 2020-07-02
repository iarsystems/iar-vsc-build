/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import { ConfirmationDialog } from "../../ui/confirmationdialog";
import { FilesNode } from "../../ui/treeprojectview";
import { ProjectCommand } from "./projectcommand";
import { NodeType, Node, ProjectContext } from "../../../iar/project/thrift/bindings/projectmanager_types";
import * as ProjectManager from "../../../iar/project/thrift/bindings/ProjectManager";

/**
 * This command removes a file or group from a project (using a thrift ProjectManager)
 */
export class RemoveNodeCommand extends ProjectCommand {
    constructor() {
        super("iar.removeNode");
    }

    async execute(source: FilesNode, pm: ProjectManager.Client, context: ProjectContext) {
        const typeString = source.iarNode.type === NodeType.File ? "file" : "group";
        try {
            const toRemove = source.iarNode;
            const shouldRemove = await ConfirmationDialog.show(`Really remove ${typeString} "${toRemove.name}"?`);
            if (!shouldRemove) { return; }

            const rootNode = await pm.GetRootNode(context);
            this.removeNode(rootNode, toRemove);
            pm.SetNode(context, rootNode);

            Vscode.window.showInformationMessage(`The ${typeString} "${toRemove.name}" has been removed from the project.`);
        } catch(e) {
            Vscode.window.showErrorMessage("Unable to remove " + typeString + ": " + e.toString());
        }
    }

    // recursively looks for a node and removes it
    private removeNode(root: Node, toRemove: Node): boolean {
        if (root.path === toRemove.path && root.name === toRemove.name) {
            return false;
        }
        root.children = root.children.filter(child => {
            return this.removeNode(child, toRemove);
        });
        return true;
    }
}