

import * as Vscode from "vscode";

export interface Logging {
    debug(msg: string, ...args: string[]): void;
    warning(msg: string, ...args: string[]): void;
    error(msg: string, ...args: string[]): void;
    info(msg: string, ...args: string[]): void;
}

class ChannelLogger implements Logging {

    private readonly channel: Vscode.OutputChannel;

    constructor(context: Vscode.ExtensionContext) {
        this.channel = Vscode.window.createOutputChannel("iar-vsc");

        context.subscriptions.push(this.channel);
    }

    debug(message: string, ...args: string[]): void {
        this.print("Debug", message, ...args);
    }

    warning(message: string, ...args: string[]): void {
        this.print("Warning", message, ...args);
    }

    error(message: string, ...args: string[]): void {
        this.print("Error", message, ...args);
    }
    info(message: string, ...args: string[]): void {
        this.print("Info", message, ...args);
    }

    private print(logType: string, message: string, ...args: string[]) {
        let msg = "[" + logType + "] " + message;

        args.forEach((arg, idx) => {
            msg = msg.replace(new RegExp(`\\{${idx}\\}`, "g"), arg);
        });

        this.channel.appendLine(msg);
    }
}

class NullLogger implements Logging {
    debug(): void {
        // Not implemented
    }

    warning(): void {
        // Not implemented
    }

    error(): void {
        // Not implemented
    }

    info(): void {
        // Not implemented
    }
}

export namespace Logging {
    let logger: Logging = new NullLogger();

    export function setup(context: Vscode.ExtensionContext): void {
        logger = new ChannelLogger(context);
    }

    export function getInstance(): Logging {
        return logger;
    }
}