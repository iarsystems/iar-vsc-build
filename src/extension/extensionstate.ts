/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import { ExtendedWorkbench } from "../iar/extendedworkbench";
import { ToolManager } from "../iar/tools/manager";
import { AsyncObservable } from "../utils/asyncobservable";
import { WorkbenchListModel } from "./model/selectworkbench";
import { WorkspaceListModel } from "./model/selectworkspace";
import { LocalSettings } from "./settings/localsettings";
import { LoadingService } from "./loadingservice";
import { logger } from "iar-vsc-common/logger";
import { WorkbenchFeatures } from "iar-vsc-common/workbenchfeatureregistry";
import { InformationMessage, InformationMessageType } from "./ui/informationmessage";
import { EwWorkspace } from "../iar/workspace/ewworkspace";
import { Disposable } from "../utils/disposable";
import { OsUtils } from "iar-vsc-common/osUtils";
import { Workbench } from "iar-vsc-common/workbench";
import { AddWorkbenchCommand } from "./command/addworkbench";
import { Project } from "../iar/project/project";
import { ErrorUtils } from "../utils/utils";

class State implements Disposable {

    readonly workbenches: WorkbenchListModel;
    private readonly extendedWorkbench: AsyncObservable<ExtendedWorkbench>;

    readonly workspaces: WorkspaceListModel;
    readonly workspace: AsyncObservable<EwWorkspace>;

    // The project paths to populate our workspace with when no eww file is available
    private fallbackProjects: string[] = [];

    private readonly loader: LoadingService;

    constructor(toolmanager: ToolManager) {

        this.workbenches = new WorkbenchListModel();
        this.workspaces = new WorkspaceListModel();
        this.extendedWorkbench = new AsyncObservable();
        this.workspace = new AsyncObservable();
        this.loader = new LoadingService(this.extendedWorkbench, this.workspace);

        this.addListeners();

        this.workbenches.set(...toolmanager.workbenches);
        toolmanager.addInvalidateListener(() => {
            this.workbenches.set(...toolmanager.workbenches);
        });
    }

    reloadWorkspace(): Promise<void> {
        return this.loadActiveWorkspace();
    }

    async dispose() {
        this.workspace.setValue(undefined);
        const workbench = await this.extendedWorkbench.getValue();
        this.extendedWorkbench.setValue(undefined);
        await workbench?.dispose();
    }

    /**
     * Sets the project paths to populate the project list with when no workspace
     * file is selected (i.e. when no workspace files are available).
     */
    public setFallbackProjects(projects: string[]) {
        this.fallbackProjects = projects;
        if (!this.workspaces.selected) {
            // We are currently using the (old) fallback projects, so reload the
            // workspace with the new ones
            this.loadActiveWorkspace();
        }
    }
    public getFallbackProjects() {
        return this.fallbackProjects;
    }

    private addListeners(): void {
        this.workbenches.addOnSelectedHandler(() => {
            logger.debug("Selected workbench: " + this.workbenches.selected?.name);
            if (this.workbenches.selected) {
                LocalSettings.setSelectedWorkbench(this.workbenches.selected);

            }

            this.loader.loadWorkbench(this.workbenches.selected).
                catch(this.workbenchErrorHandler(this.workbenches.selected));
            this.loadActiveWorkspace();
        });
        this.workbenches.addOnInvalidateHandler(async() => {
            const storedWbPath = LocalSettings.getSelectedWorkbench();
            if (storedWbPath) {
                this.workbenches.selectWhen(wb => OsUtils.pathsEqual(storedWbPath, wb.path));
            }
            if (!this.workbenches.selected && this.workbenches.amount > 0) {
                const workspace = await this.workspace.getValue();
                const activeProject = workspace?.projects.selected;
                if (activeProject) {
                    State.selectWorkbenchMatchingProject(activeProject, this.workbenches);
                }
            }
        });

        this.workspaces.addOnSelectedHandler(() => {
            logger.debug("Selected workspace: " + this.workspaces.selected?.name);
            if (this.workspaces.selected) {
                LocalSettings.setSelectedWorkspace(this.workspaces.selected);
            }
            this.loadActiveWorkspace();

        });
        this.workspaces.addOnInvalidateHandler(() => {
            const storedWsPath = LocalSettings.getSelectedWorkspace();
            if (storedWsPath) {
                this.workspaces.selectWhen(ws => OsUtils.pathsEqual(storedWsPath, ws.path));
            }
            if (!this.workspaces.selected && this.workspaces.amount > 0) {
                this.workspaces.select(0);
            }
        });

        this.extendedWorkbench.onValueDidChange(exWb => {
            logger.debug(`Loaded thrift workbench '${exWb?.workbench.name}'`);

            if (exWb) {
                // If workbench crashes, fall back to non-extended (non-thrift) functionality.
                exWb.onCrash(exitCode => {
                    Vscode.window.showErrorMessage(`The IAR project manager exited unexpectedly (code ${exitCode}). Try reloading the window or upgrading the project from IAR Embedded Workbench.`);
                    logger.error(`Thrift workbench '${exWb.workbench.name}' crashed (code ${exitCode})`);
                    this.loader.loadWorkbench(undefined);
                    this.loadActiveWorkspace();
                });

                // Early versions of the thrift project manager cannot load workspace files. Warn the user if relevant.
                if (this.workspaces.selected && !WorkbenchFeatures.supportsFeature(exWb.workbench, WorkbenchFeatures.PMWorkspaces)) {
                    let message = "The selected IAR toolchain does not fully support loading workspace files. You may experience some unexpected behaviour.";
                    const minVersions = WorkbenchFeatures.getMinProductVersions(exWb.workbench, WorkbenchFeatures.PMWorkspaces);
                    if (minVersions.length > 0) {
                        message += ` To fix this, please upgrade to ${minVersions.join(", ")} or later.`;
                    }

                    InformationMessage.show("cannotLoadWorkspaces", message, InformationMessageType.Warning);
                }
            }
        });

        this.workbenches.addOnSelectedHandler(model => {
            if (model.selected !== undefined && !WorkbenchFeatures.supportsFeature(model.selected, WorkbenchFeatures.VSCodeIntegration)) {
                const minVersions = WorkbenchFeatures.getMinProductVersions(model.selected, WorkbenchFeatures.VSCodeIntegration);
                InformationMessage.show(
                    "unsupportedWorkbench",
                    "The selected IAR toolchain is not supported by this extension." + (minVersions.length > 0 ? ` The minimum supported version is ${minVersions.join(", ")}.`: ""),
                    InformationMessageType.Error);
            }
        });

        this.workspace.onValueDidChange(newWorkspace => {
            logger.debug(`Loaded workspace '${newWorkspace?.name}'`);
            if (newWorkspace) {
                newWorkspace.projects.addOnSelectedHandler(() => {
                    if (!this.workbenches.selected && newWorkspace.projects.selected) {
                        State.selectWorkbenchMatchingProject(newWorkspace.projects.selected, this.workbenches);
                    }
                });
                if (!this.workbenches.selected && newWorkspace.projects.selected) {
                    State.selectWorkbenchMatchingProject(newWorkspace.projects.selected, this.workbenches);
                }
            }
        });
    }

    private loadActiveWorkspace() {
        const errHandler = (e: unknown) => {
            const errMsg = ErrorUtils.toErrorMessage(e);
            Vscode.window.showErrorMessage(`IAR: Failed to load workspace. Some functionality may be unavailable: ${errMsg}`);
            logger.error(`Error loading workspace: ` + errMsg);
        };
        if (this.workspaces.selected) {
            return this.loader.loadWorkspace(this.workspaces.selected).catch(errHandler);
        } else {
            if (this.fallbackProjects.length > 0) {
                return this.loader.loadAnonymousWorkspace(this.fallbackProjects).catch(errHandler);
            }
            return this.loader.loadWorkspace(undefined);
        }
    }

    private workbenchErrorHandler(workbench: Workbench | undefined) {
        return (e: unknown) => {
            const errMsg = ErrorUtils.toErrorMessage (e);
            Vscode.window.showErrorMessage(`Error initiating IAR toolchain backend. Some functionality may be unavailable: ${errMsg}`);
            logger.debug(`Error loading thrift workbench '${workbench?.name}': ${errMsg}`);
        };
    }

    /**
     * Implements the default workbench selection behaviour, for folders where no choice has yet been made.
     *
     * Selects the first workbench that supports all targets in the given project. If there are multiple such
     * workbenches, the user is notified that they should confirm if the default choice is the right one. If there is no
     * such workbench, the user is prompted to locate one.
     * @returns Whether the selected workbench was changed
     */
    private static selectWorkbenchMatchingProject(project: Project, workbenchModel: WorkbenchListModel): boolean {
        if (project.configurations.length === 0) {
            return false;
        }

        // Use a map to get all *unique* toolchains
        const projectToolchains = new Map<string, void>();
        project.configurations.forEach(conf => projectToolchains.set(conf.targetId));
        const projectToolchainsArray = Array.from(projectToolchains.keys());
        // Select the first workbench that has all project toolchains.
        // Here, we're comparing 'toolchains' (internal thrift id), and 'targets' (the name of the toolchain directory on disk).
        // These are not necessarily equivalent, but it's okay for this function to give false negatives.
        const candidates = workbenchModel.workbenches.filter(workbench => projectToolchainsArray.every(target => workbench.targetIds.includes(target)));
        if (candidates.length === 0) {
            if (workbenchModel.amount > 0) {
                Vscode.window.showWarningMessage(
                    `No available IAR toolchain for target(s) '${projectToolchainsArray.map(Workbench.getTargetDisplayName).join(", ")}'.`,
                    "Add IAR toolchain",
                ).then(response => {
                    if (response === "Add IAR toolchain") {
                        Vscode.commands.executeCommand(AddWorkbenchCommand.ID);
                    }
                });
            }
            return false;
        }
        // Prioritize newer workbench versions
        const candidatesPrioritized = candidates.sort((wb1, wb2) =>
            (wb2.version.major - wb1.version.major) || (wb2.version.minor - wb1.version.minor) || (wb2.version.patch - wb1.version.patch));
        // There is at least one candidate, select the first one.
        workbenchModel.selectWhen(item => item === candidatesPrioritized[0]);
        if (candidates.length > 1) {
            InformationMessage.show(
                "multipleWorkbenchCandidates",
                `Found multiple IAR toolchains for '${projectToolchainsArray.map(Workbench.getTargetDisplayName).join(", ")}'. Please make sure '${workbenchModel.selected?.name}' is the correct one.`,
                InformationMessageType.Info
            );
        }
        return true;
    }

}

export namespace ExtensionState {
    let state: State | undefined = undefined;

    export function init(manager: ToolManager) {
        state = new State(manager);
    }

    export function getInstance(): State {
        if (!state) {
            throw new Error("Extension state has not been initialized.");
        }

        return state;
    }
}
