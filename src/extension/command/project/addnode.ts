/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Path from "path";
import * as Vscode from "vscode";
import { Node, NodeType } from "iar-vsc-common/thrift/bindings/projectmanager_types";
import { FilesNode } from "../../ui/treeprojectprovider";
import { ProjectCommand } from "./projectcommand";
import { ExtendedProject } from "../../../iar/project/project";
import { logger } from "iar-vsc-common/logger";
import { ErrorUtils } from "../../../utils/utils";


/**
 * This command adds a file to an existing group
 */
export class AddFileCommand extends ProjectCommand {
    constructor() {
        super("iar-build.addFile");
    }

    execute(source: FilesNode | undefined, project: ExtendedProject) {
        if (source === undefined) {
            return;
        }
        return AddFile.execute(source, project);
    }
}
/**
 * This command adds a file to the root (top) level of a project
 */
export class AddFileToRootCommand extends ProjectCommand {
    constructor() {
        super("iar-build.addFileToRoot");
    }

    execute(_source: FilesNode, project: ExtendedProject) {
        return AddFile.execute(undefined, project);
    }
}


namespace AddFile {
    /**
     * Adds file(s) to the given node, or to the project root if the target is undefined.
     * @param target The node to add the file(s) under
     * @param project The project to which to add files
     * @returns
     */
    export async function execute(target: FilesNode | undefined, project: ExtendedProject) {
        try {
            const projectDir = Path.dirname(project.path.toString());
            const uris = await Vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectMany: true,
                defaultUri: Vscode.Uri.file(projectDir),
                filters: filePickerFilters,
            });
            if (uris === undefined || uris.length === 0) {
                return;
            }
            const rootNode = await project.getRootNode();
            const parent = target === undefined ? rootNode : target.iarNode;
            logger.debug(`Adding [${uris.join(", ")}] to node '${parent.name}' in '${project.name}'`);


            uris.forEach(uri => {
                const name = Path.basename(uri.fsPath);
                parent.children.push(new Node({ children: [], name: name, type: NodeType.File, path: uri.fsPath, ...getNodeDefaults(), isGenerated: false }));
            });

            await project.setNode(parent, target ? target.indexPath : []);
        } catch (e) {
            const errMsg = ErrorUtils.toErrorMessage(e);
            Vscode.window.showErrorMessage("Unable to add file(s): " + errMsg);
            logger.error("Unable to add file(s): " + errMsg);
        }
    }

    // Same filters as used in EW
    const filePickerFilters =
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
 * This command adds a group to an existing group
 */
export class AddGroupCommand extends ProjectCommand {
    constructor() {
        super("iar-build.addGroup");
    }

    execute(source: FilesNode | undefined, project: ExtendedProject) {
        if (source === undefined) {
            return;
        }
        return AddGroup.addGroup(source, project);
    }
}

/**
 * This command adds a group to the root (top) level of a project
 */
export class AddGroupToRootCommand extends ProjectCommand {
    constructor() {
        super("iar-build.addGroupToRoot");
    }

    execute(_source: FilesNode | undefined, project: ExtendedProject) {
        return AddGroup.addGroup(undefined, project);
    }
}

namespace AddGroup {
    /**
     * Adds a group to the given node, or to the project root if the target is undefined.
     * @param target The node to add the group under
     * @param project The project to which to add the group
     * @returns
     */
    export async function addGroup(target: FilesNode | undefined, project: ExtendedProject) {
        try {
            const rootNode = await project.getRootNode();
            const parent = target === undefined ? rootNode : target.iarNode;

            const name = await Vscode.window.showInputBox({ prompt: "Enter a name for the group", placeHolder: "MyGroup" });
            if (!name) {
                return;
            }
            logger.debug(`Adding '${name}' to node '${parent.name}' in '${project.name}'`);

            if (parent.children.some(child => child.type === NodeType.Group && child.name === name)) {
                throw new Error("A group with the same name already exists.");
            }

            const fullPath = Path.join(Path.dirname(project.path.toString()), name);
            const node = new Node({ children: [], name, type: NodeType.Group, path: fullPath, ...getNodeDefaults(), isGenerated: false });
            parent.children.push(node);
            await project.setNode(parent, target ? target.indexPath : []);
        } catch (e) {
            const errMsg = ErrorUtils.toErrorMessage(e);
            Vscode.window.showErrorMessage("Unable to add group: " + errMsg);
            logger.error("Unable to add group: " + errMsg);
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