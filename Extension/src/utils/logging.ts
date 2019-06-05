'use strict';

import * as Vscode from "vscode";

export interface Logging {
    debug(msg: string, ...args: any[]): void;
    warning(msg: string, ...args: any[]): void;
    error(msg: string, ...args: any[]): void;
    info(msg: string, ...args: any[]): void;
}

class ChannelLogger implements Logging {

    private channel: Vscode.OutputChannel;

    constructor(context: Vscode.ExtensionContext) {
        this.channel = Vscode.window.createOutputChannel("iar-vsc");

        context.subscriptions.push(this.channel);
    }

    debug(message: string, ...args: any[]): void {
        this.print("Debug", message, ...args);
    }

    warning(message: string, ...args: any[]): void {
        this.print("Warning", message, ...args);
    }

    error(message: string, ...args: any[]): void {
        this.print("Error", message, ...args);
    }
    info(message: string, ...args: any[]): void {
        this.print("Info", message, ...args);
    }

    private print(logType: string, message: string, ...args: any[]) {
        let msg = "[" + logType + "] " + message;

        for (let idx in args) {
            msg = msg.replace(new RegExp(`\\{${idx}\\}`, 'g'), args[idx]);
        }

        this.channel.appendLine(msg);
    }
}

class NullLogger implements Logging {
    debug(): void {
    }

    warning(): void {
    }

    error(): void {
    }

    info(): void {
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