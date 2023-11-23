/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import { ConfirmationDialog } from "../../ui/confirmationdialog";
import { FilesNode } from "../../ui/treeprojectprovider";
import { ProjectCommand } from "./projectcommand";
import { NodeType, Node } from "iar-vsc-common/thrift/bindings/projectmanager_types";
import { ExtendedProject } from "../../../iar/project/project";
import { logger } from "iar-vsc-common/logger";
import { WorkbenchFeatures } from "iar-vsc-common/workbenchfeatureregistry";
import { ExtensionState } from "../../extensionstate";
import { ErrorUtils } from "../../../utils/utils";

/**
 * This command removes a file or group from a project (using a thrift ProjectManager)
 */
export class RemoveNodeCommand extends ProjectCommand {
    constructor() {
        super("iar-build.removeNode");
    }

    async execute(source: FilesNode, project: ExtendedProject) {
        const workbench = ExtensionState.getInstance().workbenches.selected;
        if (workbench && !WorkbenchFeatures.supportsFeature(workbench, WorkbenchFeatures.SetNodeCanRemoveNodes)) {
            let errMsg = "Due to a bug, this Embedded Workbench version can not remove project members from VS Code.";
            const minVersions = WorkbenchFeatures.getMinProductVersions(workbench, WorkbenchFeatures.SetNodeCanRemoveNodes);
            if (minVersions.length > 0) {
                errMsg += ` Please upgrade to ${minVersions.join(", ")} or later.`;
            }
            Vscode.window.showErrorMessage(errMsg);
            return;
        }

        const typeString = source.iarNode.type === NodeType.File ? "file" : "group";
        try {
            const toRemove = source.iarNode;
            const promptText = `Are you sure you want to remove ${typeString} "${toRemove.name}" from the project?`;
            const shouldRemove = await ConfirmationDialog.show(promptText, source.iarNode.type === NodeType.File ? "The file will remain on disk." : undefined);
            if (!shouldRemove) {
                return;
            }
            logger.debug(`Removing node '${toRemove.name}' from '${project.name}'`);

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
            const errMsg = ErrorUtils.toErrorMessage(e);
            Vscode.window.showErrorMessage("Unable to remove " + typeString + ": " + errMsg);
            logger.error("Unabled to remove node: " + errMsg);
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