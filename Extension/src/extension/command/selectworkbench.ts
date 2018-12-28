'use strict';

import * as Vscode from "vscode";
import { Command } from "./command";
import { Input } from "../ui/input";
import { Workbench } from "../../iar/tools/workbench";
import { ListInputModel } from "../model/model";

class CommandImpl implements Command {
    command: string;
    private input: Input<Workbench>;

    constructor(model: ListInputModel<Workbench>) {
        this.command = "iar.selectWorkbench";
        this.input = Input.createListInput(model);
    }

    execute(): void {
        this.input.show();
    }

    register(context: Vscode.ExtensionContext): void {
        let cmd = Vscode.commands.registerCommand(this.command, this.execute, this);
        context.subscriptions.push(cmd);
    }
}

export namespace SelectWorkbenchCommand {
    export function createCommand(model: ListInputModel<Workbench>): Command {
        return new CommandImpl(model);
    }
}
