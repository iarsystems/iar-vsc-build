/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Fs from "fs";
import * as Path from "path";
import * as Vscode from "vscode";
import { Node, NodeType } from "../../../iar/project/thrift/bindings/projectmanager_types";
import { FilesNode, ProjectNode } from "../../ui/treeprojectview";
import { ProjectCommand } from "./projectcommand";
import { ExtendedProject } from "../../../iar/project/project";

/**
 * This command adds a file or group to a project (using a thrift ProjectManager)
 */
export class AddNodeCommand extends ProjectCommand {
    constructor() {
        super("iar.addNode");
    }

    async execute(source: ProjectNode, project: ExtendedProject) {
        try {
            const rootNode = await project.getRootNode();
            // The source is either a FilesNode corresponding to a group, or the user clicked the top-level "Files"
            // item, in which case we should add to the root node
            const newParent = source instanceof FilesNode ? source.iarNode : rootNode;

            const types = [
                { label: "File", description: "A source file", type: NodeType.File },
                { label: "Group", description: "A group containing files", type: NodeType.Group }
            ];
            const selectedType = await Vscode.window.showQuickPick(types, { placeHolder: "What do you want to add?" });
            if (!selectedType) { return; }

            const typeString = selectedType.type === NodeType.File ? "file" : "group";
            const placeHolder = selectedType.type === NodeType.File ? "my_src.c" : "MyGroup";

            const name = await Vscode.window.showInputBox({ prompt: "Enter a name for the " + typeString, placeHolder });
            if (!name) { return; }

            const fullPath = Path.join(Path.dirname(project.path.toString()), name);
            if (selectedType.type === NodeType.File && !Fs.existsSync(fullPath)) {
                Fs.writeFileSync(fullPath, "");
            }

            newParent.children.push(new Node({ children: [], name, type: selectedType.type, path: fullPath }));
            await project.setNode(newParent);

            Vscode.window.showInformationMessage(`The ${typeString} "${name}" has been added to the project.`);
        } catch(e) {
            Vscode.window.showErrorMessage("Unable to add file/group: " + e.toString());
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