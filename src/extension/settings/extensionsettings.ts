/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import * as Fs from "fs";

export namespace ExtensionSettings {

    export enum ExtensionSettingsField {
        Defines = "defines",
        ExtraBuildArguments = "extraBuildArguments",
        IarInstallDirectories = "iarInstallDirectories",
        CstatFilterLevel = "c-stat.filterLevel",
        CstatDisplayLowSeverityWarningsAsHints = "c-stat.displayLowSeverityWarningsAsHints",
        CstatAutoOpenReports = "c-stat.autoOpenReports",
        CstatShowInToolbar = "c-stat.showInToolbar",
        ColorizeBuildOutput = "colorizeBuildOutput",
        ProjectsToExclude = "projectsToExclude",
        BuildOutputLogLevel = "buildOutputLogLevel",
        AutoExpandFileTree = "autoExpandFileTree",
    }

    const section = "iar-build";

    export function observeSetting(field: ExtensionSettingsField, callback: () => void): void {
        Vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration(section + "." + field.toString())) {
                callback();
            }
        });
    }

    export function getIarInstallDirectories(): string[] {
        const directories = Vscode.workspace.getConfiguration(section).get(ExtensionSettingsField.IarInstallDirectories);
        return (directories ?? []) as string[];
    }
    export function setIarInstallDirectories(installDirs: Fs.PathLike[]): Thenable<void> {
        return Vscode.workspace.getConfiguration(section).update(ExtensionSettingsField.IarInstallDirectories, installDirs, true);
    }

    export function getDefines(): string[] {
        const defines = Vscode.workspace.getConfiguration(section).get(ExtensionSettingsField.Defines);

        if (defines) {
            return defines as string[];
        } else {
            return [];
        }
    }

    export function getExtraBuildArguments(): Array<string> {
        const args = Vscode.workspace.getConfiguration(section).get(ExtensionSettingsField.ExtraBuildArguments);
        if (args) {
            return args as string[];
        } else {
            return [];
        }
    }

    export function getCstatFilterLevel(): "Low" | "Medium" | "High" {
        const lvl = Vscode.workspace.getConfiguration(section).get<string>(ExtensionSettingsField.CstatFilterLevel);
        if (lvl === "Low" || lvl === "Medium" || lvl === "High") {
            return lvl;
        }
        return "Low";
    }
    export function getCstatDisplayLowSeverityWarningsAsHints(): boolean {
        const val = Vscode.workspace.getConfiguration(section).get<boolean>(ExtensionSettingsField.CstatDisplayLowSeverityWarningsAsHints);
        return val ?? false;
    }
    export function getCstatAutoOpenReports(): boolean {
        const val = Vscode.workspace.getConfiguration(section).get<boolean>(ExtensionSettingsField.CstatAutoOpenReports);
        return val ?? false;
    }
    export function getCstatShowInToolbar(): boolean {
        const val = Vscode.workspace.getConfiguration(section).get<boolean>(ExtensionSettingsField.CstatShowInToolbar);
        return val ?? true;
    }
    export function setCstatShowInToolbar(value:  boolean) {
        Vscode.workspace.getConfiguration(section).update(ExtensionSettingsField.CstatShowInToolbar, value);
    }
    export function getColorizeBuildOutput(): boolean {
        const val = Vscode.workspace.getConfiguration(section).get<boolean>(ExtensionSettingsField.ColorizeBuildOutput);
        return val ?? false;
    }
    export function getProjectsToExclude(): string | undefined {
        return Vscode.workspace.getConfiguration(section).get<string>(ExtensionSettingsField.ProjectsToExclude);
    }
    export function getBuildOutputLogLevel(): "all" | "info" | "warnings" | "errors" {
        // we map the user-facing "pretty" values to the iarbuild parameter equivalents
        const lvl = Vscode.workspace.getConfiguration(section).get<string>(ExtensionSettingsField.BuildOutputLogLevel);
        if (lvl === undefined) {
            return "info";
        }
        const map: Record<string, ReturnType<typeof getBuildOutputLogLevel>> = {
            "All": "all",
            "Messages": "info",
            "Warnings": "warnings",
            "Errors": "errors",
        };
        return map[lvl] ?? "info";
    }
    export function getAutoExpandFileTree(): boolean {
        const val = Vscode.workspace.getConfiguration(section).get<boolean>(ExtensionSettingsField.AutoExpandFileTree);
        return val ?? true;
    }
}
