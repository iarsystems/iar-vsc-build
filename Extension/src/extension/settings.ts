
'use strict';

import * as Vscode from "vscode";
import * as Fs from "fs";
import { Handler } from "../utils/handler";

export namespace Settings {
    type ChangeHandler = (section: Field, newValue: string) => void;

    export enum Field {
        Workbench = "workbench",
        Compiler = "compiler",
        Ewp = "ewp",
        Configuration = "configuration",
        Defines = "defines"
    }

    const section = "iarvsc";
    const iarInstallDirectories = "iarInstallDirectories";

    let observers: Map<Field, Handler<ChangeHandler>[]> = new Map();

    export function addObserver(field: Field, handler: ChangeHandler) {
        let list = observers.get(field);

        if (!list) {
            list = new Array<Handler<ChangeHandler>>();

            observers.set(field, list);
        }

        list.push(new Handler(handler, undefined));
    }

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

        fireChange(Field.Workbench, path.toString());
    }

    export function getCompiler(): Fs.PathLike | undefined {
        return Vscode.workspace.getConfiguration(section).get(Field.Compiler);
    }

    export function setCompiler(path: Fs.PathLike): void {
        Vscode.workspace.getConfiguration(section).update(Field.Compiler, path.toString());

        fireChange(Field.Compiler, path.toString());
    }

    export function getEwpFile(): Fs.PathLike | undefined {
        return Vscode.workspace.getConfiguration(section).get(Field.Ewp);
    }

    export function setEwpFile(path: Fs.PathLike): void {
        Vscode.workspace.getConfiguration(section).update(Field.Ewp, path.toString());

        fireChange(Field.Ewp, path.toString());
    }

    export function getConfiguration(): string | undefined {
        return Vscode.workspace.getConfiguration(section).get(Field.Configuration);
    }

    export function setConfiguration(name: string): void {
        Vscode.workspace.getConfiguration(section).update(Field.Configuration, name);

        fireChange(Field.Configuration, name);
    }

    export function getDefines(): string[] {
        let defines = Vscode.workspace.getConfiguration(section).get(Field.Defines);

        if (defines) {
            return defines as string[];
        } else {
            return [];
        }
    }

    function fireChange(field: Field, newValue: string) {
        let list = observers.get(field);

        if (list) {
            list.forEach(handler => {
                handler.call(field, newValue);
            });
        }
    }
}
