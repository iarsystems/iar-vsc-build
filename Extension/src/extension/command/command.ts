/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

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
    enabled: boolean;

    execute(): any;
    register(context: Vscode.ExtensionContext): void;
}

export abstract class CommandBase implements Command {
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

    execute(): any {
        if (this.enabled) {
            this.executeImpl();
        } else {
            Vscode.window.showErrorMessage("Extension is not yet ready, cannot execute this command. Try again later.");
        }
    }

    register(context: Vscode.ExtensionContext): void {
        let cmd = Vscode.commands.registerCommand(this.command, this.execute, this);
        context.subscriptions.push(cmd);
    }

    protected abstract executeImpl(): void;
}

class CommandWithInput<T> extends CommandBase {
    private input: Input<T>;

    constructor(command: string, model: ListInputModel<T>) {
        super(command);

        this.input = Input.createListInput(model);
    }

    executeImpl(): void {
        this.input.show();
    }
}

export namespace Command {

    class CommandManager {
        private commands_: Command[];

        public constructor() {
            this.commands_ = [];
        }

        public get commands(): Command[] {
            return this.commands_;
        }

        public add(command: Command): void {
            this.commands_.push(command);
        }

        public find(command: string): Command | undefined {
            return this.commands.find((value): boolean => {
                if (value.command === command) {
                    return true;
                } else {
                    return false;
                }
            });
        }
    }

    let manager = new CommandManager();

    export function getCommandManager(): CommandManager {
        return manager;
    }

    export function createSelectWorkbenchCommand(model: ListInputModel<Workbench>): Command {
        return createInputCommand("iar.selectWorkbench", model);
    }

    export function createSelectCompilerCommand(model: ListInputModel<Compiler>): Command {
        return createInputCommand("iar.selectCompiler", model);
    }

    export function createSelectProjectCommand(model: ListInputModel<Project>): Command {
        return createInputCommand("iar.selectProject", model);
    }

    export function createSelectConfigurationCommand(model: ListInputModel<Config>): Command {
        return createInputCommand("iar.selectConfiguration", model);
    }

    function createInputCommand<T>(command: string, model: ListInputModel<T>): Command {
        let cmd = new CommandWithInput(command, model);

        manager.add(cmd);

        return cmd;
    }
}
