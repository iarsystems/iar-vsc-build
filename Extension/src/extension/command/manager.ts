/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import { Command } from "./command";

export interface CommandManager {
    getCommand(cmd: CommandManager.Commands): Command<unknown> | undefined;
    setCommand(cmd: CommandManager.Commands, command: Command<unknown>): void;
}

class Manager implements CommandManager {
    private readonly commands: Map<CommandManager.Commands, Command<unknown>>;

    constructor() {
        this.commands = new Map();
    }

    public getCommand(cmd: CommandManager.Commands): Command<unknown> | undefined {
        return this.commands.get(cmd);
    }

    public setCommand(cmd: CommandManager.Commands, command: Command<unknown>): void {
        this.commands.set(cmd, command);
    }
}

export namespace CommandManager {
    export enum Commands {
        SelectWorkbench,
        SelectPlatform,
        SelectCompiler,
        SelectProject,
        SelectConfiguration
    }

    const manager = new Manager();
    export function getInstance(): CommandManager {
        return manager;
    }
}