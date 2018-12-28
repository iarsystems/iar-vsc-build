'use strict';

import * as Vscode from "vscode";
import { Input } from "../ui/input";
import { ListInputModel } from "../model/model";
import { Workbench } from "../../iar/tools/workbench";
import { Compiler } from "../../iar/tools/compiler";

export interface Command {
    readonly command: string;

    execute(): void;
    register(context: Vscode.ExtensionContext): void;
}

class CommandImpl<T> implements Command {
    command: string;
    private input: Input<T>;

    constructor(command: string, model: ListInputModel<T>) {
        this.command = command;
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

export namespace Command {
    export function createSelectWorkbenchCommand(model: ListInputModel<Workbench>): Command {
        return new CommandImpl("iar.selectWorkbench", model);
    }

    export function createSelectCompilerCommand(model: ListInputModel<Compiler>): Command {
        return new CommandImpl("iar.selectCompiler", model);
    }
}
