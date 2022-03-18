/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import { ConfirmationDialog } from "../../ui/confirmationdialog";
import { FilesNode } from "../../ui/treeprojectprovider";
import { ProjectCommand } from "./projectcommand";
import { NodeType, Node } from "../../../iar/project/thrift/bindings/projectmanager_types";
import { ExtendedProject } from "../../../iar/project/project";

/**
 * This command removes a file or group from a project (using a thrift ProjectManager)
 */
export class RemoveNodeCommand extends ProjectCommand {
    constructor() {
        super("iar.removeNode");
    }

    async execute(source: FilesNode, project: ExtendedProject) {
        const typeString = source.iarNode.type === NodeType.File ? "file" : "group";
        try {
            const toRemove = source.iarNode;
            const promptText = `Are you sure you want to remove ${typeString} "${toRemove.name}" from the project?`;
            const shouldRemove = await ConfirmationDialog.show(promptText, source.iarNode.type === NodeType.File ? "The file will remain on disk." : undefined);
            if (!shouldRemove) {
                return;
            }

            const parent = source.parent;
            if (parent === undefined) {
                // should never happen
                console.error(`Parent was not populated for node ${source.name}`);
                return;
            }
            parent.iarNode.children.splice(parent.iarNode.children.indexOf(source.iarNode), 1);
            await project.setNode(parent.iarNode, parent.indexPath);

            Vscode.window.showInformationMessage(`The ${typeString} "${toRemove.name}" has been removed from the project.`);
        } catch (e) {
            if (typeof e === "string" || e instanceof Error) {
                Vscode.window.showErrorMessage("Unable to remove " + typeString + ": " + e.toString());
            } else {
                Vscode.window.showErrorMessage("Unable to remove " + typeString + ".");
            }
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