/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import { Input, ListInput } from "../ui/listinput";
import { ListInputModel } from "../model/model";
import { Workbench } from "iar-vsc-common/workbench";
import { Project } from "../../iar/project/project";
import { Config } from "../../iar/project/config";
import { ArgVarsFile } from "../../iar/project/argvarfile";

/**
 * A VS Code command.
 * @typeParam T the type of value the command returns
 */
export interface Command<T> {
    readonly id: string;

    execute(autoTriggered?: boolean): T | undefined;
    register(context: Vscode.ExtensionContext): void;
}

export abstract class CommandBase<T> implements Command<T> {
    readonly id: string;

    constructor(id: string) {
        this.id = id;
    }

    execute(autoTriggered?: boolean): T | undefined {
        return this.executeImpl(autoTriggered);
    }

    register(context: Vscode.ExtensionContext): void {
        const cmd = Vscode.commands.registerCommand(this.id, this.execute, this);
        context.subscriptions.push(cmd);
    }

    protected abstract executeImpl(autoTriggered?: boolean): T;
}

/**
 * Prompts the user to select a value from the list model and updates the model's selected value
 */
class ListSelectionCommand<T> extends CommandBase<void> {
    private readonly input: Input<T>;

    constructor(id: string, model: ListInputModel<T>) {
        super(id);

        this.input = new ListInput(model);
    }

    executeImpl(_autoTriggered?: boolean): void {
        this.input.show();
    }
}

export namespace Command {
    export function createSelectWorkbenchCommand(model: ListInputModel<Workbench>): ListSelectionCommand<Workbench> {
        return createInputCommand("iar-build.selectToolchain", model);
    }

    export function createSelectProjectCommand(model: ListInputModel<Project>): ListSelectionCommand<Project> {
        return createInputCommand("iar-build.selectProject", model);
    }

    export function createSelectConfigurationCommand(model: ListInputModel<Config>): ListSelectionCommand<Config> {
        return createInputCommand("iar-build.selectConfiguration", model);
    }

    export function createSelectArgVarsFileCommand(model: ListInputModel<ArgVarsFile>): ListSelectionCommand<ArgVarsFile> {
        return createInputCommand("iar-build.selectArgumentVariablesFile", model);
    }

    function createInputCommand<T>(command: string, model: ListInputModel<T>): ListSelectionCommand<T> {
        return new ListSelectionCommand(command, model);
    }
}
