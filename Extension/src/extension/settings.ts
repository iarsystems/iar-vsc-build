/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import * as Fs from "fs";
import * as Path from "path";

type cStandards = "c89" | "c99" | "c11";
type cppStandards = "c++98" | "c++03" | "c++11" | "c++14" | "c++17";

export namespace Settings {

    export enum ExtensionSettingsField {
        Defines = "defines",
        CStandard = "cStandard",
        CppStandard = "cppStandard",
        ExtraBuildArguments = "extraBuildArguments",
        IarInstallDirectories = "iarInstallDirectories",
    }

    export enum LocalSettingsField {
        Workbench = "workbench",
        Ewp = "ewp",
        Configuration = "configuration",
    }

    const section = "iarvsc";

    let settingsFile: LocalSettingsFile | undefined = undefined;

    export function observeSetting(field: ExtensionSettingsField, callback: () => void): void {
        Vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration(section + "." + field.toString())) {
                callback();
            }
        });
    }

    export function getIarInstallDirectories(): Fs.PathLike[] {
        const directories = Vscode.workspace.getConfiguration(section).get(ExtensionSettingsField.IarInstallDirectories);
        return (directories ?? []) as string[];
    }

    export function getLocalSetting(field: LocalSettingsField): string | undefined {
        return getSettingsFile()?.get(field);
    }

    export function setLocalSetting(field: LocalSettingsField, value: string) {
        getSettingsFile()?.set(field, value);
    }

    export function getWorkbench(): string | undefined {
        return getLocalSetting(LocalSettingsField.Workbench);
    }
    export function setWorkbench(path: Fs.PathLike) {
        setLocalSetting(LocalSettingsField.Workbench, path.toString());
    }
    export function getEwpFile(): string | undefined {
        return getLocalSetting(LocalSettingsField.Ewp);
    }
    export function setEwpFile(path: Fs.PathLike) {
        setLocalSetting(LocalSettingsField.Ewp, path.toString());
    }
    export function getConfiguration(): string | undefined {
        return getLocalSetting(LocalSettingsField.Configuration);
    }
    export function setConfiguration(name: string) {
        setLocalSetting(LocalSettingsField.Configuration, name);
    }

    export function getDefines(): string[] {
        const defines = Vscode.workspace.getConfiguration(section).get(ExtensionSettingsField.Defines);

        if (defines) {
            return defines as string[];
        } else {
            return [];
        }
    }

    export function getCStandard(): cStandards {
        const standard = Vscode.workspace.getConfiguration(section).get(ExtensionSettingsField.CStandard) as string;

        if (isCStandard(standard)) {
            return standard;
        } else {
            return "c11";
        }
    }

    export function getCppStandard(): cppStandards {
        const standard = Vscode.workspace.getConfiguration(section).get(ExtensionSettingsField.CppStandard) as string;

        if (isCppStandard(standard)) {
            return standard;
        } else {
            return "c++14";
        }
    }

    export function getExtraBuildArguments(): Array<string> {
        return Vscode.workspace.getConfiguration(section).get(ExtensionSettingsField.ExtraBuildArguments) as Array<string>;
    }

    function generateSettingsFilePath(): Fs.PathLike | undefined  {
        const folders = Vscode.workspace.workspaceFolders as Vscode.WorkspaceFolder[];
        if (folders[0] !== undefined) {
            const folder = folders[0].uri.fsPath;
            return Path.join(folder, ".vscode", "iar-vsc.json");
        }
        return undefined;
    }

    function getSettingsFile(): LocalSettingsFile | undefined {
        if (settingsFile === undefined) {
            const path = generateSettingsFilePath();
            if (path !== undefined) {
                settingsFile = new LocalSettingsFile(path);
            }
        }

        return settingsFile;
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

interface LocalSettings {
    ewp?: string;
    compiler?: string;
    workbench?: string;
    configuration?: string;
}

/**
 * The settings file which stores the currently selected workbench/project etc in a workspace.
 */
class LocalSettingsFile {
    private readonly path_: Fs.PathLike;
    private json_: LocalSettings;

    constructor(path: Fs.PathLike) {
        this.path_ = path;
        this.json_ = LocalSettingsFile.loadFile(this.path);
    }

    get path(): Fs.PathLike {
        return this.path_;
    }

    public get(field: Settings.LocalSettingsField): string | undefined {
        if (field in this.json_) {
            return this.json_[field];
        } else {
            return undefined;
        }
    }

    public set(field: Settings.LocalSettingsField, value: string): void {
        this.json_[field] = value;
        this.save();
    }

    public remove(field: Settings.LocalSettingsField): void {
        if (field in this.json_) {
            delete this.json_[field];
            this.save();
        }
    }

    private save(): void {
        const dirname = Path.parse(this.path.toString()).dir;

        if (!Fs.existsSync(dirname)) {
            Fs.mkdirSync(dirname);
        }

        Fs.writeFileSync(this.path, JSON.stringify(this.json_, undefined, 4));
    }

    public static exists(path: Fs.PathLike): boolean {
        return Fs.existsSync(path);
    }

    private static loadFile(path: Fs.PathLike): LocalSettings  {
        if (!LocalSettingsFile.exists(path)) {
            return {};
        } else {
            const content = Fs.readFileSync(path);

            return JSON.parse(content.toString());
        }
    }
}