/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Path from "path";
import * as Vscode from "vscode";
import { Node, NodeType } from "iar-vsc-common/thrift/bindings/projectmanager_types";
import { FilesNode } from "../../ui/treeprojectprovider";
import { ProjectCommand } from "./projectcommand";
import { ExtendedProject } from "../../../iar/project/project";


/**
 * This command adds a file to a project (using a thrift ProjectManager)
 */
export class AddFileCommand extends ProjectCommand {
    constructor() {
        super("iar.addFile");
    }

    async execute(source: FilesNode | undefined, project: ExtendedProject) {
        try {
            const projectDir = Path.dirname(project.path.toString());
            const uris = await Vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectMany: true,
                defaultUri: Vscode.Uri.file(projectDir),
                filters: AddFileCommand.filePickerFilters,
            });
            if (uris === undefined || uris.length === 0) {
                return;
            }

            const rootNode = await project.getRootNode();
            const parent = source === undefined ? rootNode : source.iarNode;

            uris.forEach(uri => {
                const name = Path.basename(uri.fsPath);
                parent.children.push(new Node({ children: [], name: name, type: NodeType.File, path: uri.fsPath, ...getNodeDefaults(), isGenerated: false }));
            });

            await project.setNode(parent, source ? source.indexPath : []);
        } catch (e) {
            if (typeof e === "string" || e instanceof Error) {
                Vscode.window.showErrorMessage("Unable to add file: " + e.toString());
            } else {
                Vscode.window.showErrorMessage("Unable to add file.");
            }
        }
    }

    // Same filters as used in EW
    private static readonly filePickerFilters =
        {
            "Source Files": [ "c", "cpp", "cc", "h", "hpp", "s*", "msa", "asm", "vsp" ],
            "C/C++ Files": [ "c", "cpp", "cc", "h", "hpp" ],
            "C / C++ Source Files": [ "c", "cpp", "cc" ],
            "C / C++ Header Files": [ "h", "hpp" ],
            "Assembler Files": [ "s*", "msa", "asm" ],
            "Library / Object Files": [ "r*", "a", "lib", "o" ],
            "IAR Visual State Project Files": [ "vsp" ],
            "All Files": [ "*" ],
        };
}

/**
 * This command adds a group to a project (using a thrift ProjectManager)
 */
export class AddGroupCommand extends ProjectCommand {
    constructor() {
        super("iar.addGroup");
    }

    async execute(source: FilesNode | undefined, project: ExtendedProject) {
        try {
            const rootNode = await project.getRootNode();
            const parent = source === undefined ? rootNode : source.iarNode;

            const name = await Vscode.window.showInputBox({ prompt: "Enter a name for the group", placeHolder: "MyGroup" });
            if (!name) {
                return;
            }

            const fullPath = Path.join(Path.dirname(project.path.toString()), name);
            const node = new Node({ children: [], name, type: NodeType.Group, path: fullPath, ...getNodeDefaults(), isGenerated: false });
            parent.children.push(node);
            await project.setNode(parent, source ? source.indexPath : []);
        } catch (e) {
            if (typeof e === "string" || e instanceof Error) {
                Vscode.window.showErrorMessage("Unable to add group: " + e.toString());
            } else {
                Vscode.window.showErrorMessage("Unable to add group.");
            }
        }
    }
}

function getNodeDefaults() {
    return {
        childrenHaveLocalSettings: false,
        hasLocalSettings: false,
        hasRelevantSettings: false,
        isExcludedFromBuild: false,
        isMfcEnabled: false,
    };
}