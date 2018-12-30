
'use strict';

import * as Vscode from "vscode";
import * as Process from "child_process";
import { CommandBase } from "./command";
import { WorkbenchListModel } from "../model/selectworkbench";

/**
 * A command to open the selected IAR workbench.
 * 
 * For now it is not yet possible to also open the eww file. We only have
 * references to ewp files, but IAR does not open them correctly when passing
 * them as an argument.
 * 
 * TODO: make possible to select eww file or auto detect eww file from the ewp?
 *       If we are going to search for eww files containing the specified ewp
 *       file, what with the case if there are multiple eww files containing the
 *       ewp file?
 */
class OpenWorkbenchCommand extends CommandBase {
    private workbenchModel: WorkbenchListModel;

    constructor(workbenchModel: WorkbenchListModel) {
        super("iar.openWorkbench");

        this.workbenchModel = workbenchModel;
    }

    executeImpl(): void {
        if (this.workbenchModel.selected) {
            let cmd = this.workbenchModel.selected.idePath.toString();

            let proc = Process.spawn(cmd, [], { detached: true, stdio: "ignore" });

            proc.unref();
        } else {
            Vscode.window.showErrorMessage("No workbench is selected.");
        }
    }
}

export namespace Command {
    export function createOpenWorkbenchCommand(workbenchModel: WorkbenchListModel) {
        return new OpenWorkbenchCommand(workbenchModel);
    }
}

