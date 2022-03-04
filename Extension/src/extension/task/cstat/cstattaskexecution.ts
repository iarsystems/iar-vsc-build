/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import { CStatTaskDefinition } from "./cstattaskprovider";
import { CStat } from "../../../iar/tools/cstat";

/**
 * Executes a c-stat task, i.e. generates and clears C-STAT warnings and displays them in vs code.
 * The Pseudoterminal is needed for custom task executions, and based on the official example:
 * https://github.com/microsoft/Vscode-extension-samples/blob/master/task-provider-sample/src/customTaskProvider.ts
 */
export class CStatTaskExecution implements Vscode.Pseudoterminal {
    private readonly writeEmitter = new Vscode.EventEmitter<string>();
    onDidWrite: Vscode.Event<string> = this.writeEmitter.event;
    private readonly closeEmitter = new Vscode.EventEmitter<void>();
    onDidClose?: Vscode.Event<void> = this.closeEmitter.event;

    /**
     * @param extensionPath Path to the extension root
     * @param diagnostics A diagnostics collection to place the results in (or clear results from)
     * @param definition The task definition to execute
     */
    constructor(private readonly extensionPath: string, private readonly diagnostics: Vscode.DiagnosticCollection,
        private readonly definition: CStatTaskDefinition) {
    }

    open(_initialDimensions: Vscode.TerminalDimensions | undefined): void {
        if (this.definition.action === "run") {
            this.generateDiagnostics();
        } else if (this.definition.action === "clear") {
            this.clearDiagnostics();
        }
    }

    close(): void {
        // Nothing to do here
    }

    /**
     * Runs C-STAT on the current project and updates the warnings displayed in VS Code
     */
    private async generateDiagnostics(): Promise<void> {
        const projectPath = this.definition.project;
        const configName = this.definition.config;
        const builderPath = this.definition.builder;
        const extraArgs = this.definition.extraBuildArguments;

        this.writeEmitter.fire("Running C-STAT...\r\n");

        try {
            let warnings = await CStat.runAnalysis(builderPath, projectPath, configName, this.extensionPath, extraArgs, msg => {
                msg = msg.replace(/(?<!\r)\n/g, "\r\n"); // VSC-82: vscode console prefers crlf, so replace all lf with crlf
                this.writeEmitter.fire(msg);
            });
            this.writeEmitter.fire("Analyzing output...\r\n");
            this.diagnostics.clear();

            const filterString = Vscode.workspace.getConfiguration("iarvsc").get<string>("c-stat.filterLevel");
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
            this.closeEmitter.fire();
        }

    }

    /**
     * Clears all C-STAT warnings
     */
    private clearDiagnostics() {
        this.writeEmitter.fire("Clearing C-STAT Warnings...\r\n");
        this.diagnostics.clear();
        this.closeEmitter.fire(undefined);
    }

    private onError(reason: string | Error) {
        this.writeEmitter.fire(reason + "\r\n");
        this.closeEmitter.fire(undefined);
    }

    private static warningToDiagnostic(warning: CStat.CStatWarning): Vscode.Diagnostic {
        const pos = this.makePosition(warning.line, warning.col);
        const range = new Vscode.Range(pos, pos);

        let severity = Vscode.DiagnosticSeverity.Warning;
        if (Vscode.workspace.getConfiguration("iarvsc").get<boolean>("c-StatDisplayLowSeverityWarningsAsHints")) {
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
        diagnostic.source = warning.checkId + ` [${severityString}]`;
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