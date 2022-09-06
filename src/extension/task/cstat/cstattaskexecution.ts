/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import { CStatTaskDefinition } from "./cstattaskprovider";
import { CStat, CStatReport } from "../../../iar/tools/cstat";
import { IarOsUtils, OsUtils } from "iar-vsc-common/osUtils";
import * as Path from "path";
import { Workbench } from "iar-vsc-common/workbench";
import { EwpFile } from "../../../iar/project/parsing/ewpfile";
import { ExtensionState } from "../../extensionstate";
import { Settings } from "../../settings";
import { logger } from "iar-vsc-common/logger";

/**
 * Executes a c-stat task, i.e. generates and clears C-STAT warnings and displays them in vs code.
 * The Pseudoterminal is needed for custom task executions, and based on the official example:
 * https://github.com/microsoft/Vscode-extension-samples/blob/master/task-provider-sample/src/customTaskProvider.ts
 */
export class CStatTaskExecution implements Vscode.Pseudoterminal {

    private readonly writeEmitter = new Vscode.EventEmitter<string>();
    onDidWrite: Vscode.Event<string> = this.writeEmitter.event;
    private readonly closeEmitter = new Vscode.EventEmitter<number>();
    onDidClose?: Vscode.Event<number> = this.closeEmitter.event;

    /**
     * @param extensionPath Path to the extension root
     * @param diagnostics A diagnostics collection to place the results in (or clear results from)
     * @param definition The task definition to execute
     */
    constructor(private readonly extensionPath: string, private readonly diagnostics: Vscode.DiagnosticCollection,
        private readonly definition: Partial<CStatTaskDefinition>) {
    }

    open(_initialDimensions: Vscode.TerminalDimensions | undefined): void {
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
        const toolchain = this.definition.toolchain;
        if (!toolchain) {
            this.onError("No toolchain path was specificed. Select one in the extension configuration, or configure the task manually.");
            return;
        }

        const workspaceFolder = Vscode.workspace.getWorkspaceFolder(Vscode.Uri.file(projectPath))?.uri.fsPath ?? Vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        if (this.definition.action === "run") {
            this.generateDiagnostics(projectPath, configName, toolchain, workspaceFolder);
        } else if (this.definition.action === "clear") {
            this.clearDiagnostics();
        } else if (this.definition.action === "report-full") {
            this.generateHTMLReport(projectPath, configName, toolchain, true, workspaceFolder);
        } else if (this.definition.action === "report-summary") {
            this.generateHTMLReport(projectPath, configName, toolchain, false, workspaceFolder);
        } else {
            this.writeEmitter.fire(`Unrecognized action '${this.definition.action}'`);
            this.closeEmitter.fire(0);
        }
    }

    close(): void {
        // Nothing to do here
    }

    /**
     * Runs C-STAT on the current project and updates the warnings displayed in VS Code
     */
    private async generateDiagnostics(projectPath: string, configName: string, toolchain: string, workspaceFolder?: string): Promise<void> {
        const extraArgs = this.definition.extraBuildArguments ?? Settings.getExtraBuildArguments();
        if (this.definition.argumentVariablesFile) {
            extraArgs.unshift("-varfile", this.definition.argumentVariablesFile);
        }

        this.writeEmitter.fire("Running C-STAT...\r\n");

        try {
            const builderPath = Path.join(toolchain, Workbench.builderSubPath);
            const outputDir = await CStatTaskExecution.getPossibleCStatOutputDirectories(projectPath, configName);
            let warnings = await CStat.runAnalysis(
                builderPath,
                projectPath,
                configName,
                outputDir,
                this.extensionPath,
                extraArgs,
                workspaceFolder ?? Path.dirname(builderPath),
                this.write.bind(this));

            this.writeEmitter.fire("Analyzing output...\r\n");
            this.diagnostics.clear();

            const filterString = Settings.getCstatFilterLevel();
            const filterLevel = filterString ?
                CStat.SeverityStringToSeverityEnum(filterString)
                : CStat.CStatWarningSeverity.LOW;
            warnings = warnings.filter(w => w.severity >= filterLevel);
            this.writeEmitter.fire("After filtering, " + warnings.length + " warning(s) remain.\r\n");

            const fileDiagnostics: [Vscode.Uri, Vscode.Diagnostic[]][] = [];
            warnings.forEach(warning => {
                const diagnostic = CStatTaskExecution.warningToDiagnostic(warning);
                fileDiagnostics.push([Vscode.Uri.file(warning.file), [diagnostic]]);
            });

            this.diagnostics.set(fileDiagnostics);
            this.writeEmitter.fire("C-STAT is done!\r\n");
        } catch (e) {
            if (typeof e === "string" || e instanceof Error) {
                this.onError(e);
            }
        } finally {
            this.closeEmitter.fire(0);
        }

    }

    /**
     * Generates an HTML report of all C-STAT warnings
     */
    private async generateHTMLReport(projectPath: string, configName: string, toolchain: string, full: boolean, workspaceFolder?: string): Promise<void> {
        this.writeEmitter.fire((full ? "Generating Full HTML Report" : "Generating HTML Summary Report") + "...\r\n");

        try {
            // In order to find the path to ireport, we need to know the toolchain of this configuration.
            // To find it, load the project with the xml parser (this is pretty cheap).
            const project = new EwpFile(projectPath);
            const config = project.configurations.find(conf => conf.name === configName);
            if (!config) {
                throw new Error(`No such configuration '${configName}' for project '${project.name}'.`);
            }
            const outputDirs = await CStatTaskExecution.getPossibleCStatOutputDirectories(projectPath, configName);
            const ireportPath = Path.join(toolchain, config.targetId, "bin/ireport" + IarOsUtils.executableExtension());

            const reportPath = await CStatReport.generateHTMLReport(
                ireportPath,
                outputDirs,
                Path.basename(projectPath, ".ewp"),
                full,
                workspaceFolder ?? Path.dirname(ireportPath),
                this.write.bind(this)
            );
            if (Settings.getCstatAutoOpenReports()) {
                await Vscode.env.openExternal(Vscode.Uri.file(reportPath));
            }
        } catch (e) {
            if (typeof e === "string" || e instanceof Error) {
                this.onError(e);
            }
        } finally {
            this.closeEmitter.fire(0);
        }

    }

    /**
     * Clears all C-STAT warnings
     */
    private clearDiagnostics() {
        this.writeEmitter.fire("Clearing C-STAT Warnings...\r\n");
        this.diagnostics.clear();
        this.closeEmitter.fire(0);
    }

    private write(msg: string) {
        msg = msg.replace(/(?<!\r)\n/g, "\r\n"); // VSC-82: vscode console prefers crlf, so replace all lf with crlf
        console.log("CSTAT: " + msg);
        this.writeEmitter.fire(msg);
    }

    private onError(reason: string | Error) {
        console.log("CSTATERR: " + reason.toString());
        this.writeEmitter.fire(reason + "\r\n");
        this.closeEmitter.fire(1);
    }

    // Gets the output directory for C-STAT files (e.g. where the cstat database and reports are created).
    // If we can't get it from thrift, several *guesses* are returned, which should each be checked in order.
    private static async getPossibleCStatOutputDirectories(projectPath: string, config: string): Promise<string[]> {
        try {
            const extendedProject = await ExtensionState.getInstance().extendedProject.getValue();
            if (extendedProject !== undefined && OsUtils.pathsEqual(extendedProject.path.toString(), projectPath)) {
                const outDir = await extendedProject.getCStatOutputDirectory(config);
                if (outDir !== undefined) {
                    logger.debug(`Got C-STAT directory from project settings: ${outDir}`);
                    return [Path.join(Path.dirname(projectPath), outDir)];
                }
            }
        } catch (e) {
            logger.warn("Failed to fetch C-STAT directory: " + e);
        }
        logger.debug("Using default C-STAT directory");
        // The default c-stat output directory varies depending on the IDE version the project was created with, which
        // we don't know. Therefore we guess at all possible values.
        return [
            Path.join(Path.dirname(projectPath), config + "/C-STAT"),
            Path.join(Path.dirname(projectPath), config + "\\C-STAT"),
            Path.join(Path.dirname(projectPath), config, "Obj")
        ];
    }

    private static warningToDiagnostic(warning: CStat.CStatWarning): Vscode.Diagnostic {
        const pos = this.makePosition(warning.line, warning.col);
        const range = new Vscode.Range(pos, pos);

        let severity = Vscode.DiagnosticSeverity.Warning;
        if (Settings.getCstatDisplayLowSeverityWarningsAsHints()) {
            if (warning.severity === CStat.CStatWarningSeverity.LOW) {
                severity = Vscode.DiagnosticSeverity.Hint;
            }
        }

        const severityString = warning.severity === CStat.CStatWarningSeverity.LOW ? "Low"
            : warning.severity === CStat.CStatWarningSeverity.MEDIUM ? "Medium"
                : "High";

        const diagnostic = new Vscode.Diagnostic(range, warning.message, severity);
        diagnostic.relatedInformation = warning.trace.map(traceItem => {
            return new Vscode.DiagnosticRelatedInformation(new Vscode.Location(Vscode.Uri.file(traceItem.file), this.makePosition(traceItem.line, 1)), traceItem.message);
        });
        diagnostic.source = "cstat";
        diagnostic.code = warning.checkId + " [" + severityString + "]";
        return diagnostic;
    }
    private static makePosition(cstatLine: number, cstatCol: number): Vscode.Position {
        // C-STAT uses 1-based lines/cols and VS Code 0-based.
        // HOWEVER, C-STAT uses line/col 0 to indicate file-global warnings, so make sure these aren't placed at line/col -1
        const line = Math.max(cstatLine - 1, 0);
        const col = Math.max(cstatCol - 1, 0);
        return new Vscode.Position(line, col);
    }
}