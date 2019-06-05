/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import * as Fs from "fs";
import * as Path from "path";
import { Handler } from "../utils/handler";

type cStandards = "c89" | "c99" | "c11";
type cppStandards = "c++98" | "c++03" | "c++11" | "c++14" | "c++17";

class SettingsFile {
    private path_: Fs.PathLike;
    private json_: any

    constructor(path: Fs.PathLike) {
        this.path_ = path;
        this.json_ = SettingsFile.loadFile(this.path);
    }

    get path(): Fs.PathLike {
        return this.path_;
    }

    public get(field: Settings.Field): any {
        if (field in this.json_) {
            return this.json_[field];
        } else {
            return undefined;
        }
    }

    public set(field: Settings.Field, value: any): void {
        this.json_[field] = value;
        this.save();
    }

    public remove(field: Settings.Field): void {
        if (field in this.json_) {
            delete this.json_[field];
            this.save();
        }
    }

    private save(): void {
        let dirname = Path.parse(this.path.toString()).dir;

        if (!Fs.existsSync(dirname)) {
            Fs.mkdirSync(dirname);
        }

        Fs.writeFileSync(this.path, JSON.stringify(this.json_, undefined, 4));
    }

    public static exists(path: Fs.PathLike): boolean {
        return Fs.existsSync(path);
    }

    private static loadFile(path: Fs.PathLike): any {
        if (!SettingsFile.exists(path)) {
            return {};
        } else {
            let content = Fs.readFileSync(path);

            return JSON.parse(content.toString());
        }
    }
}

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

    let settingsFile: SettingsFile | undefined = undefined;
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
        return getSettingsFile().get(Field.Workbench);
    }

    export function setWorkbench(path: Fs.PathLike): void {
        getSettingsFile().set(Field.Workbench, path);

        fireChange(Field.Workbench, path.toString());
    }

    export function getCompiler(): Fs.PathLike | undefined {
        return getSettingsFile().get(Field.Compiler);
    }

    export function setCompiler(path: Fs.PathLike): void {
        getSettingsFile().set(Field.Compiler, path);

        fireChange(Field.Compiler, path.toString());
    }

    export function getEwpFile(): Fs.PathLike | undefined {
        return getSettingsFile().get(Field.Ewp);
    }

    export function setEwpFile(path: Fs.PathLike): void {
        getSettingsFile().set(Field.Ewp, path);

        fireChange(Field.Ewp, path.toString());
    }

    export function getConfiguration(): string | undefined {
        return getSettingsFile().get(Field.Configuration);
    }

    export function setConfiguration(name: string): void {
        getSettingsFile().set(Field.Configuration, name);

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

    export function getCStandard(): cStandards {
        let standard = Vscode.workspace.getConfiguration(section).get(Field.CStandard) as string;

        if (isCStandard(standard)) {
            return standard;
        } else {
            return "c89";
        }
    }

    export function getCppStandard(): cppStandards {
        let standard = Vscode.workspace.getConfiguration(section).get(Field.CppStandard) as string;

        if (isCppStandard(standard)) {
            return standard;
        } else {
            return "c++98";
        }
    }

    export function getExtraBuildArguments(): Array<string> {
        return Vscode.workspace.getConfiguration(section).get(Field.ExtraBuildArguments) as Array<string>;
    }

    function generateSettingsFilePath(): Fs.PathLike {
        let folders = Vscode.workspace.workspaceFolders as Vscode.WorkspaceFolder[];
        let folder = folders[0].uri.fsPath;

        let path = Path.join(folder, ".vscode", "iar-vsc.json");

        return path;
    }

    function getSettingsFile(): SettingsFile {
        if (settingsFile === undefined) {

            settingsFile = new SettingsFile(generateSettingsFilePath());
        }

        return settingsFile;
    }

    function fireChange(field: Field, newValue: string) {
        let list = observers.get(field);

        if (list) {
            list.forEach(handler => {
                handler.call(field, newValue);
            });
        }
    }

    function isCStandard(value: string): value is cStandards {
        switch (value) {
            case "c89":
            case "c99":
            case "c11":
                return true;
            default:
                return false;
        }
    }

    function isCppStandard(value: string): value is cppStandards {
        switch (value) {
            case "c++98":
            case "c++03":
            case "c++11":
            case "c++14":
            case "c++17":
                return true;
            default:
                return false;
        }
    }
}
