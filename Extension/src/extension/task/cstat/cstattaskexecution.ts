/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import { CStatTaskDefinition } from "./cstattaskprovider";
import { OsUtils, CommandUtils } from "../../../utils/utils";
import { CStat } from "../../../iar/tools/cstat";

/**
 * Executes a c-stat task, i.e. generates and clears C-STAT warnings and displays them in vs code.
 * The Pseudoterminal is needed for custom task executions, and based on the official example:
 * https://github.com/microsoft/Vscode-extension-samples/blob/master/task-provider-sample/src/customTaskProvider.ts
 */
export class CStatTaskExecution implements Vscode.Pseudoterminal {
    private writeEmitter = new Vscode.EventEmitter<string>();
	onDidWrite: Vscode.Event<string> = this.writeEmitter.event;
	private closeEmitter = new Vscode.EventEmitter<void>();
	onDidClose?: Vscode.Event<void> = this.closeEmitter.event;

    onDidOverrideDimensions?: Vscode.Event<Vscode.TerminalDimensions | undefined> | undefined;

    private definition: CStatTaskDefinition;

    constructor(private extensionPath: string, private diagnostics: Vscode.DiagnosticCollection, definition: CStatTaskDefinition) {
        // substitute command variables
        const resolvedDef: any = definition;
        for (const property in resolvedDef) {
                resolvedDef[property] = CommandUtils.parseSettingCommands(resolvedDef[property]);
        }
        this.definition = resolvedDef;
	}

    open(_initialDimensions: Vscode.TerminalDimensions | undefined): void {
        if (this.definition.action === "run") {
            this.generateDiagnostics();
        } else if (this.definition.action === "clear") {
            this.clearDiagnostics();
        }
    }

    close(): void {
    }

    /**
     * Runs C-STAT on the current project and updates the warnings displayed in VS Code
     */
    private generateDiagnostics(): Thenable<void> {
        if (OsUtils.detectOsType() !== OsUtils.OsType.Windows) {
            Vscode.window.showErrorMessage("C-STAT is only available on windows, sorry!");
            return Promise.reject();
        }

        const projectPath = this.definition.project;
        const configName = this.definition.config;
        const builderPath = this.definition.builder;

        this.writeEmitter.fire("Running C-STAT...\r\n");

        const analysis = CStat.runAnalysis(builderPath, projectPath, configName, (msg) => this.writeEmitter.fire(msg));
        return analysis.then(() => {
            return CStat.getAllWarnings(projectPath, configName, this.extensionPath).then(warnings => {
                this.writeEmitter.fire("Analyzing output...\r\n");
                this.diagnostics.clear();

                const filterString = Vscode.workspace.getConfiguration("iarvsc").get<string>("cstatFilterLevel");
                const filterLevel = filterString ? 
                                        CStat.SeverityStringToSeverityEnum(filterString)
                                        : CStat.CStatWarningSeverity.LOW;
                warnings = warnings.filter(w => w.severity >= filterLevel);
                this.writeEmitter.fire("After filtering, " + warnings.length + " warning(s) remain.\r\n");

                let fileDiagnostics: [Vscode.Uri, Vscode.Diagnostic[]][] = [];
                warnings.forEach(warning => {
                    const diagnostic = CStatTaskExecution.warningToDiagnostic(warning);
                    fileDiagnostics.push([Vscode.Uri.file(warning.file), [diagnostic]]);
                });

                this.diagnostics.set(fileDiagnostics);
                this.writeEmitter.fire("C-STAT is done!\r\n");
                this.closeEmitter.fire();
            }, this.onError.bind(this)); /* getAllWarnings.then */

        }, this.onError.bind(this)); /* analysis.then */
    }

    /**
     * Clears all C-STAT warnings
     */
    private clearDiagnostics() {
        this.writeEmitter.fire("Clearing C-STAT Warnings...\r\n");
        this.diagnostics.clear();
        this.closeEmitter.fire();
    }

    private onError(reason: any) {
        this.writeEmitter.fire(reason + "\r\n");
        this.closeEmitter.fire();
    }

    private static warningToDiagnostic(warning: CStat.CStatWarning): Vscode.Diagnostic {
        // VS Code uses zero-based lines/cols, C-STAT is one-based, so we need to correct for this.
        // Also, C-STAT seems to use (0,0) for msgs without a position, so we need to make sure
        // not to put these at (-1,-1) in VS Code (it doesn't like that).
        if (warning.line === 0) { warning.line = 1; }
        if (warning.col === 0) { warning.col = 1; }
        const pos = new Vscode.Position(warning.line - 1, warning.col - 1);
        const range = new Vscode.Range(pos, pos);

        let severity = Vscode.DiagnosticSeverity.Warning;
        if (Vscode.workspace.getConfiguration("iarvsc").get<boolean>("cstatDisplayLowSeverityWarningsAsHints")) {
            if (warning.severity === CStat.CStatWarningSeverity.LOW) { severity = Vscode.DiagnosticSeverity.Hint; }
        }

        const diagnostic = new Vscode.Diagnostic(range, warning.message, severity);
        diagnostic.source = warning.checkId;
        return diagnostic;
    }
}