/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import { ToolManager } from "../iar/tools/manager";
import { WorkbenchListModel } from "./model/selectworkbench";
import { Settings } from "./settings";
import { ListInputModel } from "./model/model";
import { Project, ExtendedProject } from "../iar/project/project";
import { ProjectListModel } from "./model/selectproject";
import { ConfigurationListModel } from "./model/selectconfiguration";
import { ExtendedWorkbench } from "../iar/extendedworkbench";
import { AsyncObservable } from "../utils/asyncobservable";
import { BehaviorSubject } from "rxjs";
import { InformationMessage, InformationMessageType } from "./ui/informationmessage";
import { WorkbenchFeatures } from "iar-vsc-common/workbenchfeatureregistry";
import { logger } from "iar-vsc-common/logger";
import { AddWorkbenchCommand } from "./command/addworkbench";
import { Workbench } from "iar-vsc-common/workbench";
import { WorkspaceListModel } from "./model/selectworkspace";
import { EwpFile } from "../iar/project/parsing/ewpfile";
import { LoadingService } from "./loadingservice";
import { EwWorkspace, ExtendedEwWorkspace } from "../iar/workspace/ewworkspace";
import { OsUtils } from "iar-vsc-common/osUtils";

/**
 * Holds most extension-wide data, such as the selected workbench, project and configuration, and loaded project etc.
 * Also handles loading projects and starting thrift project managers whenever necessary.
 *
 * Most of this uses {@link ListInputModel} and {@link SingletonModel}, which lets others listen to lists or values being selected
 * or changed (e.g. when the user selects a new configuration, a project is loaded or the list of workbenches changes).
 */
class State {
    private readonly toolManager: ToolManager;
    private readonly loadingService: LoadingService;

    // The projects to populate our ProjectListModel with when no workspace is selected
    private fallbackProjects: Project[] = [];

    // These are values chosen by the user e.g. from a dropdown.
    readonly workbench: WorkbenchListModel;
    readonly workspace: WorkspaceListModel;
    readonly project: ProjectListModel;
    readonly config: ConfigurationListModel;

    // If the selected project can also be loaded as an ExtendedProject (majestix-enabled), it will be provided here.
    // Only one project can be loaded at a time.
    readonly extendedProject: AsyncObservable<ExtendedProject>;
    // If the selected workspace file is loaded as an ExtendedEwWorkspace, it will be provided here
    readonly loadedWorkspace: AsyncObservable<ExtendedEwWorkspace>;
    // If the selected workbench has extended (majestix) capabilities, it will be provided here
    readonly extendedWorkbench: AsyncObservable<ExtendedWorkbench>;
    // Notifies whether a project or workbench is currently loading
    readonly loading = new BehaviorSubject<boolean>(false);

    constructor(toolManager: ToolManager) {
        this.toolManager = toolManager;

        this.workbench = new WorkbenchListModel(...toolManager.workbenches);
        this.workspace = new WorkspaceListModel();
        this.project = new ProjectListModel();
        this.config = new ConfigurationListModel();

        this.extendedProject = new AsyncObservable<ExtendedProject>();
        this.loadedWorkspace = new AsyncObservable<EwWorkspace>();
        this.extendedWorkbench = new AsyncObservable<ExtendedWorkbench>();

        this.loadingService = new LoadingService(this.extendedWorkbench, this.loadedWorkspace, this.extendedProject);

        this.coupleModelToSetting(this.workbench, Settings.LocalSettingsField.Workbench, workbench => workbench?.path.toString(),
            () => { // The default choice is to try to select a workbench that can load the project.
                if (this.project.selected) {
                    State.selectWorkbenchMatchingProject(this.project.selected, this.workbench);
                }
            }, true);
        this.coupleModelToSetting(this.workspace, Settings.LocalSettingsField.Workspace, workspace => workspace?.path,
            () => this.workspace.select(0)), true;
        this.coupleModelToSetting(this.project, Settings.LocalSettingsField.Ewp, project => project?.path,
            () => this.project.select(0), true);
        this.coupleModelToSetting(this.config, Settings.LocalSettingsField.Configuration, config => config?.name,
            () => this.config.select(0));

        this.addListeners();
    }

    public async dispose(): Promise<void> {
        const extendedProject = await this.extendedProject.getValue();
        if (extendedProject) {
            await extendedProject.finishRunningOperations();
        }
        const extendedWorkbench = await this.extendedWorkbench.getValue();
        if (extendedWorkbench) {
            await extendedWorkbench.dispose();
        }
    }

    /**
     * Reloads the selected workspace (if any)
     */
    public async reloadWorkspace() {
        this.loading.next(true);
        await Promise.all([
            this.loadingService.loadWorkspace(this.workspace.selected).
                catch(this.workspaceErrorHandler(this.workspace.selected)),
            this.loadingService.loadProject(this.project.selected).
                catch(this.projectErrorHandler(this.project.selected)),
        ]);
    }

    /**
     * Reloads the given project if it's currently loaded
     */
    public async reloadProject(project: Project) {
        const tasks = [
            this.loadingService.reloadProject(project).
                catch(this.projectErrorHandler(project)),
        ];
        if (this.project.selected === project) {
            tasks.push(
                this.loadingService.loadProject(project).
                    catch(this.projectErrorHandler(project))
            );
            this.loading.next(true);
        }
        await Promise.all(tasks);
    }

    /**
     * Sets the projects to populate the project list with when no workspace
     * file is selected (i.e. when no workspace files are available).
     */
    public setFallbackProjects(projects: Project[]) {
        this.fallbackProjects = projects;
        if (!this.workspace.selected) {
            this.project.set(...projects);
        }
    }
    public getFallbackProjects() {
        return this.fallbackProjects;
    }

    // Connects a list model to a persistable setting in the iar-vsc.json file, so that:
    // * Changes to the model are stored in the file.
    // * When the list contents change, tries to restore the selected value from the file.
    // This means that selected values are remembered between sessions.
    // When no value could be restored, `defaultChoiceStrategy` is called to make a default choice,
    // (e.g. select some random item)
    private coupleModelToSetting<T>(
        model: ListInputModel<T>,
        field: Settings.LocalSettingsField,
        toSettingsValue: (val: T) => string,
        defaultChoiceStrategy: () => void,
        isPath = false,
    ) {
        const setFromStoredValue = () => {
            const settingsValue = Settings.getLocalSetting(field);
            if (settingsValue) {
                const comparator = isPath ?
                    (item: T) => OsUtils.pathsEqual(settingsValue, toSettingsValue(item)) :
                    (item: T) => settingsValue === toSettingsValue(item);
                if (!model.selectWhen(comparator) && model.amount > 0) {
                    logger.debug(`Could not match item to ${field}: ${settingsValue} in iar-vsc.json`);
                    defaultChoiceStrategy();
                }
            } else {
                defaultChoiceStrategy();
            }
        };
        model.addOnInvalidateHandler(() => setFromStoredValue());
        model.addOnSelectedHandler((_, value) => {
            if (value) {
                Settings.setLocalSetting(field, toSettingsValue(value) ?? "");
            }
        });

        // Do this once at startup so that previous values are loaded
        setFromStoredValue();
    }

    private addListeners(): void {
        this.toolManager.addInvalidateListener(() => {
            this.workbench.set(...this.toolManager.workbenches);
        });

        this.addWorkbenchModelListeners();
        this.addWorkspaceModelListeners();
        this.addProjectModelListeners();
        this.addConfigurationModelListeners();
    }

    private addWorkbenchModelListeners(): void {
        // Try to load thrift services for the new workbench, and load the current workspace/project with the new services.
        this.workbench.addOnSelectedHandler(workbench => {
            logger.debug(`Toolchain: selected '${this.workbench.selected?.name}' (index ${this.workbench.selectedIndex})`);
            const selectedWb = workbench.selected;

            this.loadingService.loadWorkbench(selectedWb).
                catch(this.workbenchErrorHandler(selectedWb));
            if (this.workspace.selected) {
                this.loadingService.loadWorkspace(this.workspace.selected).
                    catch(this.workspaceErrorHandler(this.workspace.selected));
            }
            this.loadingService.loadProject(this.project.selected).
                catch(this.projectErrorHandler(this.project.selected));
            this.loading.next(true);
        });

        // If workbench crashes, fall back to non-extended (non-thrift) functionality.
        this.extendedWorkbench.onValueDidChange(exWb => {
            logger.debug(`Loaded thrift workbench '${exWb?.workbench.name}'`);
            if (exWb) {
                exWb.onCrash(exitCode => {
                    Vscode.window.showErrorMessage(`The IAR project manager exited unexpectedly (code ${exitCode}). Try reloading the window or upgrading the project from IAR Embedded Workbench.`);
                    logger.error(`Thrift workbench '${exWb.workbench.name}' crashed (code ${exitCode})`);
                    this.loadingService.loadWorkbench(undefined);
                });
            }
        });

        // Early versions of the thrift project manager cannot load workspace files. Warn the user if relevant.
        this.extendedWorkbench.onValueDidChange(exWb => {
            if (exWb) {
                if (this.workspace.selected && !WorkbenchFeatures.supportsFeature(exWb.workbench, WorkbenchFeatures.PMWorkspaces)) {
                    let message = "The selected IAR toolchain does not fully support loading workspace files. You may experience some unexpected behaviour.";
                    const minVersions = WorkbenchFeatures.getMinProductVersions(exWb.workbench, WorkbenchFeatures.PMWorkspaces);
                    if (minVersions.length > 0) {
                        message += ` To fix this, please upgrade to ${minVersions.join(", ")} or later.`;
                    }

                    InformationMessage.show("cannotLoadWorkspaces", message, InformationMessageType.Warning);
                }
            }
        });


        this.workbench.addOnSelectedHandler(model => {
            if (model.selected !== undefined && !WorkbenchFeatures.supportsFeature(model.selected, WorkbenchFeatures.VSCodeIntegration)) {
                const minVersions = WorkbenchFeatures.getMinProductVersions(model.selected, WorkbenchFeatures.VSCodeIntegration);
                InformationMessage.show(
                    "unsupportedWorkbench",
                    "The selected IAR toolchain is not supported by this extension." + (minVersions.length > 0 ? ` The minimum supported version is ${minVersions.join(", ")}.`: ""),
                    InformationMessageType.Error);
            }
        });
    }

    private addWorkspaceModelListeners(): void {
        this.workspace.addOnSelectedHandler(() => {
            logger.debug(`Workspace: selected '${this.workspace.selected?.name}' (index ${this.workspace.selectedIndex})`);
            this.loadingService.loadWorkspace(this.workspace.selected).
                catch(this.workspaceErrorHandler(this.workspace.selected));
            if (this.workspace.selected) {
                const projects: Project[] = [];
                this.workspace.selected.projects.forEach(projFile => {
                    try {
                        projects.push(new EwpFile(projFile));
                    } catch (e) {
                        // TODO: log something amazing
                        logger.error("Failed to load project: " + e);
                    }
                });
                this.project.set(...projects);
            } else {
                this.project.set(...this.fallbackProjects);
            }
        });
    }

    private addProjectModelListeners(): void {
        this.project.addOnSelectedHandler(() => {
            logger.debug(`Project: selected '${this.project.selected?.name}' (index ${this.project.selectedIndex})`);
            if (this.project.selected) {
                this.config.useConfigurationsFromProject(this.project.selected);
            } else {
                this.config.set(...[]);
            }

            if (!this.workbench.selected && this.project.selected) {
                if (State.selectWorkbenchMatchingProject(this.project.selected, this.workbench)) {
                    // The workbench was changed, the project will be loaded from the workbench onSelected handler.
                    return;
                }
            }
            this.loadingService.loadProject(this.project.selected).
                catch(this.projectErrorHandler(this.project.selected));
            this.loading.next(true);
        });

        this.extendedProject.onValueDidChange(project => {
            logger.debug(`Loaded extended project '${project?.name}'`);
            this.loading.next(false);
        });
    }

    private addConfigurationModelListeners(): void {
        this.config.addOnSelectedHandler(() => {
            logger.debug(`Configuration: selected '${this.config.selected?.name}' (index ${this.config.selectedIndex})`);
            // Check that the configuration target is supported by the selected workbench.
            const selected = this.config.selected;
            const workbench = this.workbench.selected;
            if (selected && workbench) {
                if (!workbench.targetIds.includes(selected.targetId)) {
                    Vscode.window.showErrorMessage(`The target '${Workbench.getTargetDisplayName(selected.targetId)}' is not supported by the selected IAR toolchain. Please select a different toolchain.`);
                }
            }
        });
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

    private workbenchErrorHandler(workbench: Workbench | undefined) {
        return (e: unknown) => {
            if (typeof e === "string" || e instanceof Error) {
                Vscode.window.showErrorMessage(`Error initiating IAR toolchain backend. Some functionality may be unavailable (${e.toString()}).`);
                logger.debug(`Error loading thrift workbench '${workbench?.name}': ${e.toString()}`);
            }
        };
    }
    private workspaceErrorHandler(workspace: EwWorkspace | undefined) {
        return (e: unknown) => {
            if (typeof e === "string" || e instanceof Error) {
                Vscode.window.showErrorMessage(`IAR: Error while loading the workspace. Some functionality may be unavailable (${e.toString()}).`);
                logger.error(`Error loading workspace '${workspace?.name}': ${e.toString()}`);
            }
        };
    }
    private projectErrorHandler(project: Project | undefined) {
        return (e: unknown) => {
            if (typeof e === "string" || e instanceof Error) {
                Vscode.window.showErrorMessage(`IAR: Error while loading the project. Some functionality may be unavailable (${e.toString()}).`);
                logger.error(`Error loading project '${project?.name}': ${e.toString()}`);
            }
        };
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
