import { logger } from "iar-vsc-common/logger";
import { OsUtils } from "iar-vsc-common/osUtils";
import * as vscode from "vscode";
import { EwpFile } from "../iar/project/parsing/ewpfile";
import { Project } from "../iar/project/project";
import { ExtensionState } from "./extensionstate";

type ProjectEventCallback = (projectPath: string) => void;

/**
 * Reacts to created/changed/deleted .ewp files in the open workspace folders in order to keep the list of available
 * projects up-to-date, and in order to reload projects when they are changed externally, e.g. from Embedded Workbench.
 */
export class EwpFileWatcherService {
    private readonly filesWatcher = new EwpFilesWatcher();

    constructor() {
        this.filesWatcher.onProjectCreated(path => {
            logger.debug("Detected new project file: " + path);
            try {
                ExtensionState.getInstance().project.addProject(new EwpFile(path));
            } catch (e) {
                logger.error(`Could not parse project file '${path}': ${e}`);
                vscode.window.showErrorMessage(`Could not parse project file '${path}': ${e}`);
            }
        });


        this.filesWatcher.onProjectDeleted(path => {
            const toRemove = ExtensionState.getInstance().project.projects.find(project => OsUtils.pathsEqual(project.path, path));
            if (toRemove) {
                logger.debug("Removing deleted project: " + path);
                ExtensionState.getInstance().project.removeProject(toRemove);
            }
        });


        this.filesWatcher.onProjectModified(async path => {
            logger.debug(`'${path}' changed on disk`);

            // Reload the project from disk if it is currently loaded
            const extendedProject = await ExtensionState.getInstance().extendedProject.getValue();
            if (extendedProject && OsUtils.pathsEqual(path, extendedProject.path)) {
                await ExtensionState.getInstance().reloadProject();
            }

            // Update the project list if necessary (e.g. because the project configurations changed)
            const projectModel = ExtensionState.getInstance().project;
            const oldProject = projectModel.projects.find(project => OsUtils.pathsEqual(project.path, path));
            const reloadedProject = new EwpFile(path);
            if (oldProject && !Project.equal(oldProject, reloadedProject)) {
                const updatedProjects: Project[] = [];
                projectModel.projects.forEach(project => {
                    if (project === oldProject) {
                        updatedProjects.push(reloadedProject);
                    } else {
                        updatedProjects.push(project);
                    }
                });
                // This will load the selected project again (i.e. for the second time if we reloaded it above),
                // but it is probably not noticable to the user.
                projectModel.set(...updatedProjects);
            }
        });
    }

    dispose() {
        this.filesWatcher.dispose();
    }
}

/**
 * Listens for created/changed/deleted .ewp files in the open workspace folders.
 * Backup files are ignored.
 */
class EwpFilesWatcher {
    private readonly ewpFilesWatcher: vscode.FileSystemWatcher;
    private readonly createdCallbacks: ProjectEventCallback[] = [];
    private readonly modifiedCallbacks: ProjectEventCallback[] = [];
    private readonly deletedCallbacks: ProjectEventCallback[] = [];

    constructor() {
        this.ewpFilesWatcher = vscode.workspace.createFileSystemWatcher("**/*.ewp");
        this.ewpFilesWatcher.onDidCreate(uri => {
            if (Project.isBackupFile(uri.fsPath)) {
                return;
            }
            this.createdCallbacks.forEach(cb => cb(uri.fsPath));
        });
        this.ewpFilesWatcher.onDidChange(uri => {
            if (Project.isBackupFile(uri.fsPath)) {
                return;
            }
            this.modifiedCallbacks.forEach(cb => cb(uri.fsPath));
        });
        this.ewpFilesWatcher.onDidDelete(uri => {
            if (Project.isBackupFile(uri.fsPath)) {
                return;
            }
            this.deletedCallbacks.forEach(cb => cb(uri.fsPath));
        });
    }

    onProjectCreated(callback: ProjectEventCallback) {
        this.createdCallbacks.push(callback);
    }
    onProjectModified(callback: ProjectEventCallback) {
        this.modifiedCallbacks.push(callback);
    }
    onProjectDeleted(callback: ProjectEventCallback) {
        this.deletedCallbacks.push(callback);
    }

    dispose() {
        this.ewpFilesWatcher.dispose();
    }
}
