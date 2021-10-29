
import * as Vscode from "vscode";
import { CommandUtils } from "../../utils/utils";

export class IarExecution extends Vscode.ProcessExecution {

    private process_: string;

    constructor(process: string, args?: string[], options?: Vscode.ProcessExecutionOptions) {
        if (args !== undefined) {
            super(process, args, options);
        } else {
            super(process, options);
        }

        this.process_ = process;
    }

    public get process(): string {
        return CommandUtils.parseSettingCommands(this.process_);
    }

    public set process(value: string) {
        this.process_ = value;
    }
}