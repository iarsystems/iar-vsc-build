
'use strict';

import * as Vscode from "vscode";
import * as Fs from "fs";

export namespace Settings {
    const section = "iarvsc";
    const iarInstallDirectories = "iarInstallDirectories";
    const workbench = "workbench";
    const compiler = "compiler";
    const ewp = "ewp";
    const configuration = "configuration";

    export function getIarInstallDirectories(): Fs.PathLike[] {
        let directories = Vscode.workspace.getConfiguration(section).get(iarInstallDirectories);

        if (directories) {
            return directories as string[];
        } else {
            return [];
        }
    }

    export function getWorkbench(): Fs.PathLike | undefined {
        return Vscode.workspace.getConfiguration(section).get(workbench);
    }

    export function setWorkbench(path: Fs.PathLike): void {
        Vscode.workspace.getConfiguration(section).update(workbench, path.toString());
    }

    export function getCompiler(): Fs.PathLike | undefined {
        return Vscode.workspace.getConfiguration(section).get(compiler);
    }

    export function setCompiler(path: Fs.PathLike): void {
        Vscode.workspace.getConfiguration(section).update(compiler, path.toString());
    }

    export function getEwpFile(): Fs.PathLike | undefined {
        return Vscode.workspace.getConfiguration(section).get(ewp);
    }

    export function setEwpFile(path: Fs.PathLike): void {
        Vscode.workspace.getConfiguration(section).update(ewp, path.toString());
    }

    export function getConfiguration(): string | undefined {
        return Vscode.workspace.getConfiguration(section).get(configuration);
    }

    export function setConfiguration(name: string): void {
        Vscode.workspace.getConfiguration(section).update(configuration, name);
    }
}
