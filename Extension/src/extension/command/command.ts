'use strict';

import * as Vscode from "vscode";
import { Input } from "../ui/input";
import { ListInputModel } from "../model/model";
import { Workbench } from "../../iar/tools/workbench";
import { Compiler } from "../../iar/tools/compiler";
import { Project } from "../../iar/project/project";
import { Config } from "../../iar/project/config";

export interface Command {
    readonly command: string;

    execute(): void;
    register(context: Vscode.ExtensionContext): void;
}

export abstract class CommandBase implements Command {
    readonly command: string;

    constructor(command: string) {
        this.command = command;
    }

    abstract execute(): void;

    register(context: Vscode.ExtensionContext): void {
        let cmd = Vscode.commands.registerCommand(this.command, this.execute, this);
        context.subscriptions.push(cmd);
    }
}

class CommandWithInput<T> extends CommandBase {
    private input: Input<T>;

    constructor(command: string, model: ListInputModel<T>) {
        super(command);

        this.input = Input.createListInput(model);
    }

    execute(): void {
        this.input.show();
    }
}

export namespace Command {
    export function createSelectWorkbenchCommand(model: ListInputModel<Workbench>): Command {
        return new CommandWithInput("iar.selectWorkbench", model);
    }

    export function createSelectCompilerCommand(model: ListInputModel<Compiler>): Command {
        return new CommandWithInput("iar.selectCompiler", model);
    }

    export function createSelectProjectCommand(model: ListInputModel<Project>): Command {
        return new CommandWithInput("iar.selectProject", model);
    }

    export function createSelectConfigurationCommand(model: ListInputModel<Config>): Command {
        return new CommandWithInput("iar.selectConfiguration", model);
    }
}
