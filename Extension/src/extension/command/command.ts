'use strict';

import * as Vscode from "vscode";

export interface Command {
    readonly command: string;

    execute(): void;
    register(context: Vscode.ExtensionContext): void;
}
