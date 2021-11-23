/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Fs from "fs";
import * as Path from "path";
import * as Vscode from "vscode";
import { Node, NodeType } from "../../../iar/project/thrift/bindings/projectmanager_types";
import { FilesNode, ProjectNode } from "../../ui/treeprojectprovider";
import { ProjectCommand } from "./projectcommand";
import { ExtendedProject } from "../../../iar/project/project";


function addNode(parent: Node, newNode: Node, project: ExtendedProject): Promise<void> {
    parent.children.push(newNode);
    return project.setNode(parent);
}

/**
 * This command adds a file to a project (using a thrift ProjectManager)
 */
export class AddFileCommand extends ProjectCommand {
    constructor() {
        super("iar.addFile");
    }

    async execute(source: ProjectNode, project: ExtendedProject) {
        try {
            const rootNode = await project.getRootNode();
            // The source is either a FilesNode corresponding to a group, or the user clicked the top-level "Files"
            // item, in which case we should add to the root node
            const parent = source instanceof FilesNode ? source.iarNode : rootNode;

            const name = await Vscode.window.showInputBox({ prompt: "Enter a name for the file", placeHolder: "my_src.c" });
            if (!name) {
                return;
            }

            const fullPath = Path.join(Path.dirname(project.path.toString()), name);
            if (!Fs.existsSync(fullPath)) {
                Fs.writeFileSync(fullPath, "");
            }

            const node = new Node({ children: [], name, type: NodeType.File, path: fullPath });
            await addNode(parent, node, project);

            Vscode.window.showInformationMessage(`The file "${name}" has been added to the project.`);
        } catch (e) {
            if (typeof e === "string" || e instanceof Error) {
                Vscode.window.showErrorMessage("Unable to add file: " + e.toString());
            } else {
                Vscode.window.showErrorMessage("Unable to add file.");
            }
        }
    }
}

/**
 * This command adds a group to a project (using a thrift ProjectManager)
 */
export class AddGroupCommand extends ProjectCommand {
    constructor() {
        super("iar.addGroup");
    }

    async execute(source: ProjectNode, project: ExtendedProject) {
        try {
            const rootNode = await project.getRootNode();
            // The source is either a FilesNode corresponding to a group, or the user clicked the top-level "Files"
            // item, in which case we should add to the root node
            const parent = source instanceof FilesNode ? source.iarNode : rootNode;

            const name = await Vscode.window.showInputBox({ prompt: "Enter a name for the group", placeHolder: "MyGroup" });
            if (!name) {
                return;
            }

            const fullPath = Path.join(Path.dirname(project.path.toString()), name);
            const node = new Node({ children: [], name, type: NodeType.Group, path: fullPath });
            await addNode(parent, node, project);

            Vscode.window.showInformationMessage(`The group "${name}" has been added to the project.`);
        } catch (e) {
            if (typeof e === "string" || e instanceof Error) {
                Vscode.window.showErrorMessage("Unable to add group: " + e.toString());
            } else {
                Vscode.window.showErrorMessage("Unable to add group.");
            }
        }
    }
}