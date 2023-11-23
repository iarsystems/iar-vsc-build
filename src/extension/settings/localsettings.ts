/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import * as Path from "path";
import * as Fs from "fs";
import { Workbench } from "iar-vsc-common/workbench";
import { Config } from "../../iar/project/config";
import { Project } from "../../iar/project/project";
import { EwwFile } from "../../iar/workspace/ewwfile";
import { logger } from "iar-vsc-common/logger";
import { ErrorUtils } from "../../utils/utils";

/**
 * Handles settings that aren't VS Code extension settings. These are stored
 * in a file in the VS Code workspace folder, and are thus local to the
 * currently opened workspace folder(s).
 *
 * The purpose of this is mostly to store the users selection of workbench, workspace etc.
 */
export namespace LocalSettings {
    // NOTE: Some of these concepts don't apply very well to multi-folder VS
    // Code workspaces. We generally try to store settings in the most relevant
    // workspace folder, but some settings are written to *all* workspace
    // folders.

    export function getSelectedWorkbench(): string | undefined {
        if (!Vscode.workspace.workspaceFolders) {
            return undefined;
        }
        return mapAndFindFirst(Vscode.workspace.workspaceFolders,
            wsFolder => resolvePath(readSettings(wsFolder).workbench, wsFolder));
    }
    export function setSelectedWorkbench(workbench: Workbench) {
        Vscode.workspace.workspaceFolders?.forEach(wsFolder => {
            const settings = readSettings(wsFolder);
            settings.workbench = encodePath(workbench.path, wsFolder);
            writeSettings(wsFolder, settings);
        });
    }

    export function getSelectedWorkspace(): string | undefined {
        if (!Vscode.workspace.workspaceFolders) {
            return undefined;
        }
        return mapAndFindFirst(Vscode.workspace.workspaceFolders,
            wsFolder => resolvePath(readSettings(wsFolder).workspace, wsFolder));
    }
    export function setSelectedWorkspace(workspace: EwwFile) {
        if (!Vscode.workspace.workspaceFolders) {
            return;
        }

        Vscode.workspace.workspaceFolders.forEach(wsFolder => {
            const settings = readSettings(wsFolder);
            settings.workspace = encodePath(workspace.path, wsFolder);
            writeSettings(wsFolder, settings);
        });
    }

    export function getSelectedProject(workspace: EwwFile | undefined): string | undefined {
        if (!Vscode.workspace.workspaceFolders) {
            return undefined;
        }

        if (!workspace) {
            return mapAndFindFirst(Vscode.workspace.workspaceFolders,
                wsFolder => resolvePath(readSettings(wsFolder).project, wsFolder));
        } else {
            const wsFolder = Vscode.workspace.getWorkspaceFolder(Vscode.Uri.file(workspace.path));
            if (!wsFolder) {
                return undefined;
            }

            const settings = readSettings(wsFolder);
            const normalizedPath = encodePath(Path.normalize(workspace.path), wsFolder).path;
            const storedPath = settings.workspaces?.[normalizedPath]?.selected;
            return resolvePath(storedPath, wsFolder);
        }
    }
    export function setSelectedProject(workspace: EwwFile | undefined, project: Project) {
        if (!Vscode.workspace.workspaceFolders) {
            return;
        }

        if (!workspace) {
            Vscode.workspace.workspaceFolders.forEach(wsFolder => {
                const settings = readSettings(wsFolder);
                settings.project = encodePath(project.path, wsFolder);
                writeSettings(wsFolder, settings);
            });
        } else {
            const wsFolder = Vscode.workspace.getWorkspaceFolder(Vscode.Uri.file(workspace.path));
            if (!wsFolder) {
                return;
            }

            const settings = readSettings(wsFolder);
            const normalizedPath = encodePath(Path.normalize(workspace.path), wsFolder).path;
            settings.workspaces ??= {};
            settings.workspaces[normalizedPath] ??= { configs: {} };
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            settings.workspaces[normalizedPath]!.selected = encodePath(project.path, wsFolder);
            writeSettings(wsFolder, settings);
        }
    }

    export function getSelectedConfiguration(workspace: EwwFile | undefined, project: Project): string | undefined {
        const wsFolder = Vscode.workspace.getWorkspaceFolder(Vscode.Uri.file((workspace ?? project).path));
        if (!wsFolder) {
            return;
        }

        const settings = readSettings(wsFolder);
        const configMap = workspace ?
            settings.workspaces?.[encodePath(Path.normalize(workspace.path), wsFolder).path]?.configs :
            settings.configs;

        return configMap?.[encodePath(Path.normalize(project.path), wsFolder).path];
    }
    export function setSelectedConfiguration(workspace: EwwFile | undefined, project: Project, config: Config) {
        const wsFolder = Vscode.workspace.getWorkspaceFolder(Vscode.Uri.file((workspace ?? project).path));
        if (!wsFolder) {
            return;
        }

        const settings = readSettings(wsFolder);
        let configMap: ConfigMap;
        if (workspace) {
            const normalizedPath = encodePath(Path.normalize(workspace.path), wsFolder).path;
            settings.workspaces ??= {};
            settings.workspaces[normalizedPath] ??= { configs: {} };
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            configMap = settings.workspaces[normalizedPath]!.configs;
        } else {
            settings.configs ??= {};
            configMap = settings.configs;
        }

        configMap[encodePath(Path.normalize(project.path), wsFolder).path] = config.name;
        writeSettings(wsFolder, settings);
    }


    function readSettings(workspaceFolder: Vscode.WorkspaceFolder): LocalSettingsFile {
        const filePath = settingsFilePath(workspaceFolder);
        try {
            if (Fs.existsSync(filePath)) {
                return JSON.parse(Fs.readFileSync(filePath).toString());
            }
        } catch (e) {
            logger.error(`Failed to read ${filePath}: ${ErrorUtils.toErrorMessage(e)}`);
        }
        return {};
    }
    function writeSettings(workspaceFolder: Vscode.WorkspaceFolder, settings: LocalSettingsFile) {
        const filePath = settingsFilePath(workspaceFolder);
        try {
            Fs.mkdirSync(Path.dirname(filePath), { recursive: true });
            Fs.writeFileSync(filePath, JSON.stringify(settings, undefined, 2));
        } catch (e) {
            logger.error(`Failed to write ${filePath}: ${ErrorUtils.toErrorMessage(e)}`);
        }
    }

    function settingsFilePath(workspaceFolder: Vscode.WorkspaceFolder) {
        return Path.join(workspaceFolder.uri.fsPath, ".vscode", "iar-vsc.json");
    }

    // Maps the elements of arr and returns the first element that is
    // mapped to a defined value (i.e. not undefined).
    function mapAndFindFirst<T, U>(arr: readonly T[], mapper: (item: T) => U | undefined): U | undefined {
        // Note that this maps items lazily, which is better than doing .map().find()
        for (const item of arr) {
            const mappedItem = mapper(item);
            if (mappedItem !== undefined) {
                return mappedItem;
            }
        }
        return undefined;
    }


    // Newtype-like interface for paths that might contain ${workspaceFolder},
    // to force distinction between them and regular (absolute) paths.
    interface RelativePath {
        path: string,
    }

    function resolvePath(path: Partial<RelativePath> | undefined, relativeTo: Vscode.WorkspaceFolder): string | undefined {
        if (path === undefined || path.path === undefined) {
            return undefined;
        }
        path.path = path.path.replace("${workspaceFolder}", relativeTo.uri.fsPath);
        return path.path;
    }
    function encodePath(path: string, relativeTo: Vscode.WorkspaceFolder): RelativePath {
        const wsRelativePath = Path.relative(relativeTo.uri.fsPath, path);
        if (!wsRelativePath.startsWith("..") && !Path.isAbsolute(wsRelativePath)) {
            return {
                path: Path.join("${workspaceFolder}", wsRelativePath)
            };
        }
        return {
            path
        };
    }

    interface ConfigMap {
        [ewp: string]: string | undefined
    }

    // The contents of a .vscode/iar-vsc.json file
    // We mark everything optional/partial here to account for the fact that
    // users might edit the file manually.
    interface LocalSettingsFile {
        workbench?: Partial<RelativePath>;
        workspace?: Partial<RelativePath>;
        project?: Partial<RelativePath>;
        workspaces?: {
            [path: string]: {
                selected?: Partial<RelativePath>,
                configs: ConfigMap,
            }
        };
        configs?: ConfigMap;
    }

}
