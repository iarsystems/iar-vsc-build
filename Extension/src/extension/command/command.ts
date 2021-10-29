/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import { Input } from "../ui/input";
import { ListInputModel } from "../model/model";
import { Workbench } from "../../iar/tools/workbench";
import { Compiler } from "../../iar/tools/compiler";
import { Project } from "../../iar/project/project";
import { Config } from "../../iar/project/config";

/**
 * A VS Code command. Produces a nice error message if called before the extension has been activated.
 * @typeParam T the type of value the command returns
 */
export interface Command<T> {
    readonly command: string;
    enabled: boolean;

    canExecute(): boolean;
    execute(autoTriggered?: boolean): T | undefined;
    register(context: Vscode.ExtensionContext): void;
}

export abstract class CommandBase<T> implements Command<T> {
    private enabled_: boolean;
    readonly command: string;

    constructor(command: string) {
        this.command = command;
        this.enabled_ = false;
    }

    get enabled(): boolean {
        return this.enabled_;
    }

    set enabled(value: boolean) {
        this.enabled_ = value;
    }

    canExecute(): boolean {
        return true;
    }

    execute(autoTriggered?: boolean): T | undefined {
        if (this.enabled) {
            return this.executeImpl(autoTriggered);
        } else if (!autoTriggered) {
            Vscode.window.showErrorMessage("Extension is not yet ready, cannot execute this command. Try again later.");
        }
        return undefined;
    }

    register(context: Vscode.ExtensionContext): void {
        const cmd = Vscode.commands.registerCommand(this.command, this.execute, this);
        context.subscriptions.push(cmd);
    }

    protected abstract executeImpl(autoTriggered?: boolean): T;
}

class CommandWithInput<T> extends CommandBase<void> {
    private readonly input: Input<T>;

    constructor(command: string, model: ListInputModel<T>) {
        super(command);

        this.input = Input.createListInput(model);
    }

    executeImpl(_autoTriggered?: boolean): void {
        this.input.show();
    }
}

export namespace Command {

    class CommandManager {
        private readonly commands_: Command<unknown>[];

        public constructor() {
            this.commands_ = [];
        }

        public get commands(): Command<unknown>[] {
            return this.commands_;
        }

        public add(command: Command<unknown>): void {
            this.commands_.push(command);
        }

        public find(command: string): Command<unknown> | undefined {
            return this.commands.find((value): boolean => {
                if (value.command === command) {
                    return true;
                } else {
                    return false;
                }
            });
        }
    }

    const manager = new CommandManager();

    export function getCommandManager(): CommandManager {
        return manager;
    }

    export function createSelectWorkbenchCommand(model: ListInputModel<Workbench>): Command<void> {
        return createInputCommand("iar.selectWorkbench", model);
    }

    export function createSelectCompilerCommand(model: ListInputModel<Compiler>): Command<void> {
        return createInputCommand("iar.selectCompiler", model);
    }

    export function createSelectProjectCommand(model: ListInputModel<Project>): Command<void> {
        return createInputCommand("iar.selectProject", model);
    }

    export function createSelectConfigurationCommand(model: ListInputModel<Config>): Command<void> {
        return createInputCommand("iar.selectConfiguration", model);
    }

    function createInputCommand<T>(command: string, model: ListInputModel<T>): Command<void> {
        const cmd = new CommandWithInput(command, model);

        manager.add(cmd);

        return cmd;
    }
}
