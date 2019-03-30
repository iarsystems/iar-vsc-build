/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

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
      Defines = "defines",
      CStandard = "cStandard",
      CppStandard = "cppStandard",
      ExtraBuildArguments = "extraBuildArguments"
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

    export function observeSetting(field: Field, callback: () => void): void {
        Vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration(section + "." + field.toString())) {
                callback();
            }
        });
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

    export function getCStandard(): string {
        return Vscode.workspace.getConfiguration(section).get(Field.CStandard) as string;
    }

    export function getCppStandard(): string {
        return Vscode.workspace.getConfiguration(section).get(Field.CppStandard) as string;
    }

    export function getExtraBuildArguments(): Array<string> {
        return Vscode.workspace.getConfiguration(section).get(Field.ExtraBuildArguments) as Array<string>;
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
