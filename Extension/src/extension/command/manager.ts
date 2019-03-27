/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import { Command } from "./command";

export { Command };

export interface CommandManager {
    getCommand(cmd: CommandManager.Commands): Command | undefined;
    setCommand(cmd: CommandManager.Commands, command: Command): void;
}

class Manager implements CommandManager {
    private commands: Map<CommandManager.Commands, Command>;

    constructor() {
        this.commands = new Map();
    }

    public getCommand(cmd: CommandManager.Commands): Command | undefined {
        return this.commands.get(cmd);
    }

    public setCommand(cmd: CommandManager.Commands, command: Command): void {
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