/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { OsUtils } from "iar-vsc-common/osUtils";
import * as Vscode from "vscode";

/**
 * A {@link Vscode.Pseudoterminal} that allows for stylizing the output (e.g. adding colors) based on regular
 * expressions. Output is processed line-by-line, and each line is matched against a set of {@link Stylizer}s that can
 * inject colors or text styles.
 */
export abstract class StylizedTerminal implements Vscode.Pseudoterminal {
    private readonly writeEmitter = new Vscode.EventEmitter<string>();
    onDidWrite: Vscode.Event<string> = this.writeEmitter.event;
    private readonly closeEmitter = new Vscode.EventEmitter<number>();
    onDidClose?: Vscode.Event<number> = this.closeEmitter.event;

    // Stores received data until a full line has been received
    private buffer = "";

    constructor(private readonly stylizers: Stylizer[]) {
    }

    write(msg: string) {
        this.buffer += msg;
        while (this.buffer.includes("\n")) {
            const newlineIndex = this.buffer.indexOf("\n");
            const line = this.buffer.slice(0, newlineIndex);
            this.writeEmitter.fire(this.process(line));
            this.buffer = this.buffer.slice(newlineIndex + 1);

            if (process.env["log-to-console"]) {
                console.log(line);
            }
        }
    }
    abstract open(): void | Promise<void>;
    abstract close(): void | Promise<void>;

    closeTerminal(exitCode: number) {
        this.closeEmitter.fire(exitCode);
    }

    private process(line: string) {
        this.stylizers.forEach(stylizer => {
            line = stylizer(line) ?? line;
        });
        return line + "\r\n";
    }
}

export type Stylizer = (line: string) => string;

function colorize8(text: string, colorCode: number) {
    return `\u001b[${colorCode}m${text}\u001b[0m`;
}
function colorize256(text: string, colorCode: number) {
    return `\u001b[38;5;${colorCode}m${text}\u001b[0m`;
}

export function stylizeError(text: string) {
    return colorize8(text, 91);
}
export function stylizeWarning(text: string) {
    return colorize8(text, 93);
}
export function stylizePunctuation(text: string) {
    return colorize256(text, 232);
}
export function stylizeBold(text: string) {
    return "\u001b[1m" + text + "\u001b[0m";
}

export function FileStylizer(line: string): string {
    const regex = OsUtils.detectOsType() === OsUtils.OsType.Windows ?
        /(?<!\w)([a-zA-Z]:(?:(?:\\\\|\\|\/)[\w .!#()-]+)+(?:\.\w+)(?:\(\d+\))?)/g :
        /(?<!\w)((?:\/[\w .!#()-]+)+(?:\.\w+)(?:\(\d+\))?)/g;
    return line.replace(regex, "\u001b[4m\u001b[34m$1\u001b[0m");
}
