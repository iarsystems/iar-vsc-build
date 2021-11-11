
import * as Vscode from "vscode";
// import { CommandUtils } from "../../utils/utils";

export class IarExecution extends Vscode.ShellExecution {

    constructor(process: string, args?: string[], options?: Vscode.ShellExecutionOptions) {
        // process = CommandUtils.parseSettingCommands(process);
        if (args !== undefined) {
            super(process, args, options);
        } else {
            super(process, options);
        }

    }
}