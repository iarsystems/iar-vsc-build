
import * as Vscode from "vscode";
import { CommandUtils } from "../../utils/utils";

export class IarExecution extends Vscode.ProcessExecution {

    constructor(process: string, args?: string[], options?: Vscode.ProcessExecutionOptions) {
        process = CommandUtils.parseSettingCommands(process);
        if (args !== undefined) {
            super(process, args, options);
        } else {
            super(process, options);
        }

    }
}