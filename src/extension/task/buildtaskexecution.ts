/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import { Settings } from "../settings";
import { BuildTaskDefinition } from "./buildtasks";
import { BackupUtils, ProcessUtils } from "../../utils/utils";
import { spawn } from "child_process";

/**
 * Executes a build task using iarbuild, e.g. to build or clean a project. We have to use a custom execution
 * (as opposed to a much simpler ShellExecution) so that we can add some custom behaviour (to mitigate VSC-192 and VSC-211)
 */
export class BuildTaskExecution implements Vscode.Pseudoterminal {
    private readonly writeEmitter = new Vscode.EventEmitter<string>();
    onDidWrite: Vscode.Event<string> = this.writeEmitter.event;
    private readonly closeEmitter = new Vscode.EventEmitter<number>();
    onDidClose?: Vscode.Event<number> = this.closeEmitter.event;

    /**
     * @param diagnostics A diagnostics collection to place the results in (or clear results from)
     * @param definition The task definition to execute
     */
    constructor(private readonly definition: Partial<BuildTaskDefinition>) {
    }

    async open(_initialDimensions: Vscode.TerminalDimensions | undefined) {
        const projectPath = this.definition.project;
        if (!projectPath) {
            this.onError("No project was specificed. Select one in the extension configuration, or configure the task manually.");
            return;
        }
        const configName = this.definition.config;
        if (!configName) {
            this.onError("No project configuration was specificed. Select one in the extension configuration, or configure the task manually.");
            return;
        }
        const builder = this.definition.builder;
        if (!builder) {
            this.onError("No builder path was specificed. Select a toolchain in the extension configuration, or configure the task manually.");
            return;
        }
        const iarbuildCommand = this.convertCommandToIarCommand(this.definition.command);
        if (!iarbuildCommand) {
            this.onError(`Unrecognized command '${this.definition.command}'`);
            return;
        }
        const args = [
            projectPath,
            iarbuildCommand,
            configName,
            "-log", "info" // VSC-124 This gives the same verbosity as EW
        ];
        let extraArgs = this.definition.extraBuildArguments;
        if (extraArgs === undefined) {
            extraArgs = Settings.getExtraBuildArguments();
        }
        if (extraArgs.length !== 0) {
            args.push(...extraArgs);
        }

        try {
            await BackupUtils.doWithBackupCheck(projectPath, async() => {
                const iarbuild = spawn(builder, args);
                this.write("> " + iarbuild.spawnargs.map(arg => `'${arg}'`).join(" ") + "\n");
                iarbuild.stdout.on("data", data => {
                    this.write(data.toString());
                });

                await ProcessUtils.waitForExit(iarbuild);
            });
        } finally {
            this.closeEmitter.fire(0);
        }
    }

    close(): void {
        // Nothing to do here
    }

    private write(msg: string) {
        msg = msg.replace(/(?<!\r)\n/g, "\r\n"); // VSC-82: vscode console prefers crlf, so replace all lf with crlf
        this.writeEmitter.fire(msg);
    }

    private onError(reason: string | Error) {
        this.writeEmitter.fire(reason + "\r\n");
        this.closeEmitter.fire(1);
    }

    private convertCommandToIarCommand(command: string | undefined): string | undefined {
        if (command === "build") {
            return "-make";
        } else if (command === "rebuild") {
            return "-build";
        } else if (command === "clean") {
            return "-clean";
        } else {
            return undefined;
        }
    }
}