/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import { ExtensionSettings } from "../settings/extensionsettings";
import { BuildTaskDefinition } from "./buildtasks";
import { BackupUtils, ErrorUtils, ProcessUtils } from "../../utils/utils";
import { spawn } from "child_process";
import { FileStylizer, stylizeBold, StylizedTerminal, stylizeError, stylizePunctuation, stylizeWarning } from "./stylizedterminal";
import * as Path from "path";
import * as Fs from "fs/promises";
import { WorkbenchFeatures } from "iar-vsc-common/workbenchfeatureregistry";
import { Workbench } from "iar-vsc-common/workbench";
import { EwwFile } from "../../iar/workspace/ewwfile";

/**
 * Executes a build task using iarbuild, e.g. to build or clean a project. We have to use a custom execution
 * (as opposed to a much simpler ShellExecution) so that we can add some custom behaviour (to mitigate VSC-192 and VSC-211)
 */
export class BuildTaskExecution extends StylizedTerminal {
    private temporaryFiles: string[] = [];

    /**
     * @param definition The task definition to execute
     */
    constructor(private readonly definition: Partial<BuildTaskDefinition>) {
        super(
            ExtensionSettings.getColorizeBuildOutput() ?
                [
                    line => line.replace(/(:)(?= (?:Warning|Error))/g, stylizePunctuation("$1")),
                    line => line.replace(/(Warning)(\[\w+\]:)/g, stylizeWarning("$1") + stylizePunctuation("$2")),
                    line => line.replace(/(Error)(\[\w+\]:)/g, stylizeError("$1") + stylizePunctuation("$2")),
                    line => line.replace(/(?<=errors: )([1-9]\d*)/gi, stylizeError("$1")),
                    line => line.replace(/(?<=warnings: )([1-9]\d*)/gi, stylizeWarning("$1")),
                    line => line.replace(/(Build failed\.)/, stylizeBold("$1")),
                    FileStylizer,
                ] : []
        );
        this.onDidClose(() => {
            this.temporaryFiles.forEach(
                file => Fs.unlink(file).catch(() => {/**/}));
            this.temporaryFiles = [];
        });
    }

    override async open() {
        const contexts = this.definition.contexts ?? [];
        if (this.definition.project && this.definition.config) {
            contexts.push({ project: this.definition.project, config: this.definition.config });
        }

        if (contexts.length === 0) {
            if (this.definition.contexts !== undefined) {
                // This was probably invoked from the batch build view
                this.onError("No project configurations have been selected to build. Add project configurations to your batch build in the Batch Build view.");
            } else {
                // This is probably "normal" single-configuration build
                this.onError("No project configuration has been selected to build. Select one in the extension configuration, or configure the task manually.");
            }
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

        let currentContext = 0;
        let returnCode = 0;
        for (const context of contexts) {
            currentContext++;

            // VSC-409 Match the drive letter casing for the project path to
            // what the target EW uses internally, since this affects the paths
            // used by the build engine in some EW versions.
            let projectPath = context.project;
            if (Path.isAbsolute(projectPath) && projectPath[0] && /[a-z]/.test(projectPath[0])) {
                const workbench = Workbench.create(Path.join(Path.dirname(builder), "../.."));
                if (workbench && WorkbenchFeatures.supportsFeature(workbench, WorkbenchFeatures.UpperCaseDriveLetters)) {
                    projectPath = projectPath[0].toUpperCase() + projectPath.substring(1);
                } else {
                    projectPath = projectPath[0].toLowerCase() + projectPath.substring(1);
                }
            }

            const args = [
                projectPath,
                iarbuildCommand,
                context.config,
                "-log",
                ExtensionSettings.getBuildOutputLogLevel()
            ];
            let extraArgs = this.definition.extraBuildArguments;
            if (extraArgs === undefined) {
                extraArgs = ExtensionSettings.getExtraBuildArguments();
            }
            if (extraArgs.length !== 0) {
                args.push(...extraArgs);
            }
            // Some versions of the IDE require that -varfile is added last
            if (this.definition.argumentVariablesFile) {
                const resolvedArgvarsFile = await this.resolveArgVarFile(this.definition.argumentVariablesFile);
                if (resolvedArgvarsFile) {
                    args.push("-varfile", resolvedArgvarsFile);
                }
            }

            const workspaceFolder = Vscode.workspace.getWorkspaceFolder(Vscode.Uri.file(context.project))?.uri.fsPath ?? Vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            try {
                await BackupUtils.doWithBackupCheck(context.project, async() => {
                    const iarbuild = spawn(builder, args, { cwd: workspaceFolder });
                    this.write("> " + iarbuild.spawnargs.map(arg => `'${arg}'`).join(" ") + "\n");
                    iarbuild.stdout.on("data", data => {
                        this.write(data.toString());
                    });

                    returnCode = await ProcessUtils.waitForExitCode(iarbuild) ?? 1;
                    if (returnCode !== 0 || currentContext === contexts.length) {
                        this.closeTerminal(returnCode);
                    }
                });
            } catch (e) {
                const errorMsg = ErrorUtils.toErrorMessage(e);
                this.onError(errorMsg);
                return;
            }

            if (returnCode !== 0 && contexts.length > 1) {
                this.onError("Batch sequence aborted due to build errors.");
                return;
            }
        }
    }

    close(): void {
        // Nothing to do here
    }

    private onError(reason: string | Error) {
        this.write(reason + "\r\n");
        this.closeTerminal(1);
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

    private async resolveArgVarFile(input: string): Promise<string | undefined> {
        if (!EwwFile.isWorkspaceFile(input)) {
            return input;
        }
        const tmpArgvarsFile = await EwwFile.generateArgvarsFileFor(input);
        if (tmpArgvarsFile) {
            this.temporaryFiles.push(tmpArgvarsFile);
            return tmpArgvarsFile;
        }

        return EwwFile.findArgvarsFileFor(input);
    }
}
