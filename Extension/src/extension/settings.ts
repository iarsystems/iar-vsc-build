
'use strict';

import * as Vscode from "vscode";
import * as Fs from "fs";

export namespace Settings {
    export enum Field {
        Workbench = "workbench",
        Compiler = "compiler",
        Ewp = "ewp",
        Configuration = "configuration"
    }

    const section = "iarvsc";
    const iarInstallDirectories = "iarInstallDirectories";

    export function getIarInstallDirectories(): Fs.PathLike[] {
        let directories = Vscode.workspace.getConfiguration(section).get(iarInstallDirectories);

        if (directories) {
            return directories as string[];
        } else {
            return [];
        }
    }

    export function getWorkbench(): Fs.PathLike | undefined {
        return Vscode.workspace.getConfiguration(section).get(Field.Workbench);
    }

    export function setWorkbench(path: Fs.PathLike): void {
        Vscode.workspace.getConfiguration(section).update(Field.Workbench, path.toString());
    }

    export function getCompiler(): Fs.PathLike | undefined {
        return Vscode.workspace.getConfiguration(section).get(Field.Compiler);
    }

    export function setCompiler(path: Fs.PathLike): void {
        Vscode.workspace.getConfiguration(section).update(Field.Compiler, path.toString());
    }

    export function getEwpFile(): Fs.PathLike | undefined {
        return Vscode.workspace.getConfiguration(section).get(Field.Ewp);
    }

    export function setEwpFile(path: Fs.PathLike): void {
        Vscode.workspace.getConfiguration(section).update(Field.Ewp, path.toString());
    }

    export function getConfiguration(): string | undefined {
        return Vscode.workspace.getConfiguration(section).get(Field.Configuration);
    }

    export function setConfiguration(name: string): void {
        Vscode.workspace.getConfiguration(section).update(Field.Configuration, name);
    }
}
