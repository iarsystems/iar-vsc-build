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
import { ExtendedWorkbench, ThriftWorkbench } from "../iar/extendedworkbench";
import { AsyncObservable } from "./model/asyncobservable";
import { BehaviorSubject } from "rxjs";
import { InformationMessage, InformationMessageType } from "./ui/informationmessage";
import { WorkbenchVersions } from "../iar/tools/workbenchversionregistry";
import { logger } from "iar-vsc-common/logger";
import { AddWorkbenchCommand } from "./command/addworkbench";
import { Workbench } from "iar-vsc-common/workbench";
import { ArgVarListModel } from "./model/selectargvars";

/**
 * Holds most extension-wide data, such as the selected workbench, project and configuration, and loaded project etc.
 * Also handles loading projects and starting thrift project managers whenever necessary.
 *
 * Most of this uses {@link ListInputModel} and {@link SingletonModel}, which lets others listen to lists or values being selected
 * or changed (e.g. when the user selects a new configuration, a project is loaded or the list of workbenches changes).
 */
class State {
    private readonly toolManager: ToolManager;

    // These are values chosen by the user e.g. from a dropdown.
    readonly workbench: WorkbenchListModel;
    readonly project: ProjectListModel;
    readonly config: ConfigurationListModel;
    readonly argVarsFile: ArgVarListModel;

    // If the selected project can also be loaded as an ExtendedProject (majestix-enabled), it will be provided here.
    // Only one project can be loaded at a time. A project is loaded when:
    // * The selected project (above) changes.
    // * The selected workbench (above) changes.
    readonly extendedProject: AsyncObservable<ExtendedProject>;
    // If the selected workbench has extended (majestix) capabilities, it will be provided here
    readonly extendedWorkbench: AsyncObservable<ExtendedWorkbench>;
    // Notifies whether a project or workbench is currently loading
    readonly loading = new BehaviorSubject<boolean>(false);

    constructor(toolManager: ToolManager) {
        this.toolManager = toolManager;

        this.workbench = new WorkbenchListModel(...toolManager.workbenches);
        this.project = new ProjectListModel();
        this.config = new ConfigurationListModel();
        this.argVarsFile = new ArgVarListModel();

        this.extendedProject = new AsyncObservable<ExtendedProject>();
        this.extendedWorkbench = new AsyncObservable<ExtendedWorkbench>();


        this.coupleModelToSetting(this.workbench, Settings.LocalSettingsField.Workbench, workbench => workbench?.path.toString(),
            () => { // The default choice is to try to select a workbench that can load the project.
                if (this.project.selected) {
                    State.selectWorkbenchMatchingProject(this.project.selected, this.workbench);
                }
            });
        this.coupleModelToSetting(this.project, Settings.LocalSettingsField.Ewp, project => project?.path,
            () => this.project.select(0));
        this.coupleModelToSetting(this.config, Settings.LocalSettingsField.Configuration, config => config?.name,
            () => this.config.select(0));
        this.coupleModelToSetting(this.argVarsFile, Settings.LocalSettingsField.ArgVarFile, argvar => argvar?.path,
            () => this.argVarsFile.select(0));

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
     * Reloads the currently selected project, if any
     */
    public async reloadProject() {
        const extProject = await this.extendedProject.getValue();
        const extWorkbench = await this.extendedWorkbench.getValue();
        if (extProject && extWorkbench) {
            // Calling unloadProject invalidates the project, so we need to make sure all in-progress operations have
            // finished first.
            const reloadTask = extProject.finishRunningOperations().then(async() => {
                await extWorkbench.unloadProject(extProject);
                return this.loadSelectedProject();
            });
            this.extendedProject.setWithPromise(reloadTask);
            await this.extendedProject.getValue();
        }
    }
    /**
     * Reloads the currently selected .custom_argvars file, if any
     */
    public async reloadArgVarsFile() {
        const extWorkbench = await this.extendedWorkbench.getValue();
        if (extWorkbench && this.argVarsFile.selected !== undefined) {
            extWorkbench.loadArgVars(this.argVarsFile.selected);
            const extProject = await this.extendedProject.getValue();
            this.extendedProject.setWithPromise((async() => {
                await extProject?.finishRunningOperations();
                await extWorkbench.loadArgVars(this.argVarsFile.selected);
                return this.loadSelectedProject();
            })());
        }
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
        toSettingsValue: (val: T | undefined) => string | undefined,
        defaultChoiceStrategy: () => void,
    ) {
        const setFromStoredValue = () => {
            const settingsValue = Settings.getLocalSetting(field);
            if (settingsValue) {
                if (!model.selectWhen(item => settingsValue === toSettingsValue(item)) && model.amount > 0) {
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
        this.addProjectModelListeners();
        this.addConfigurationModelListeners();
        this.addArgVarsFileListeners();
    }

    private addWorkbenchModelListeners(): void {
        // Try to load thrift services for the new workbench, and load the current argvars and project with the new services.
        this.workbench.addOnSelectedHandler(async workbench => {
            logger.debug(`Toolchain: selected '${this.workbench.selected?.name}' (index ${this.workbench.selectedIndex})`);
            const prevExtWb = this.extendedWorkbench.promise;
            const selectedWb = workbench.selected;

            if (selectedWb) {
                this.extendedWorkbench.setWithPromise((async() => {
                    if (ThriftWorkbench.hasThriftSupport(selectedWb)) {
                        logger.debug(`Loading thrift workbench '${selectedWb.name}'...`);
                        this.loading.next(true);
                        try {
                            return await ThriftWorkbench.from(selectedWb);
                        } catch (e) {
                            if (typeof e === "string" || e instanceof Error) {
                                Vscode.window.showErrorMessage(`Error initiating IAR toolchain backend. Some functionality may be unavailable (${e.toString()}).`);
                                logger.debug(`Error loading thrift workbench '${selectedWb.name}': ${e.toString()}`);
                            }
                            return undefined;
                        }
                    } else {
                        return undefined;
                    }
                })());
                // Wait for workbench to finish loading
                await this.extendedWorkbench.getValue();
            } else {
                this.extendedWorkbench.setValue(undefined);
            }

            const loadingTask = (async() => {
                (await this.extendedProject.getValue())?.finishRunningOperations();
                (await this.extendedWorkbench.getValue())?.loadArgVars(this.argVarsFile.selected);
                return this.loadSelectedProject();
            })();
            this.extendedProject.setWithPromise(loadingTask);

            prevExtWb.then(extWb => extWb?.dispose());
        });

        // If workbench crashes, fall back to non-extended (non-thrift) functionality.
        this.extendedWorkbench.onValueDidChange(exWb => {
            logger.debug(`Loaded thrift workbench '${exWb?.workbench.name}'`);
            if (exWb) {
                exWb.onCrash(exitCode => {
                    Vscode.window.showErrorMessage(`The IAR project manager exited unexpectedly (code ${exitCode}). Try reloading the window or upgrading the project from IAR Embedded Workbench.`);
                    logger.error(`Thrift workbench '${exWb.workbench.name}' crashed (code ${exitCode})`);
                    this.extendedWorkbench.setValue(undefined);
                    this.extendedProject.setWithPromise(this.loadSelectedProject());
                });
            }
        });

        // Early versions of the thrift project manager cannot load .custom_argvars files. Warn the user if relevant.
        this.extendedWorkbench.onValueDidChange(exWb => {
            if (exWb) {
                if (this.argVarsFile.selected && !WorkbenchVersions.doCheck(exWb.workbench, WorkbenchVersions.supportsPMWorkspaces)) {
                    let message = "The selected IAR toolchain does not fully support loading .custom_argvars files. You may experience some unexpected behaviour.";
                    const minVersions = WorkbenchVersions.getMinProductVersions(exWb.workbench, WorkbenchVersions.supportsPMWorkspaces);
                    if (minVersions.length > 0) {
                        message += ` To fix this, please upgrade to ${minVersions.join(", ")} or later.`;
                    }

                    InformationMessage.show("cannotLoadCustomArgvars", message, InformationMessageType.Warning);
                }
            }
        });

        this.workbench.addOnSelectedHandler(model => {
            if (model.selected !== undefined && !WorkbenchVersions.doCheck(model.selected, WorkbenchVersions.supportsVSCode)) {
                const minVersions = WorkbenchVersions.getMinProductVersions(model.selected, WorkbenchVersions.supportsVSCode);
                InformationMessage.show(
                    "unsupportedWorkbench",
                    "The selected IAR toolchain is not supported by this extension." + (minVersions.length > 0 ? ` The minimum supported version is ${minVersions.join(", ")}.`: ""),
                    InformationMessageType.Error);
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
            this.extendedProject.setWithPromise(this.loadSelectedProject());
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

    private addArgVarsFileListeners(): void {
        this.argVarsFile.addOnSelectedHandler(async() => {
            const eWb = await this.extendedWorkbench.getValue();
            if (eWb === undefined) {
                return;
            }
            const ePr = await this.extendedProject.getValue();
            this.extendedProject.setWithPromise((async() => {
                await ePr?.finishRunningOperations();
                await eWb.loadArgVars(this.argVarsFile.selected);
                return this.loadSelectedProject();
            })());
        });
    }

    // Loads a project using the appropriate method depending on whether an extended workbench
    // is available. Any previously loaded project is unloaded.
    // Note that this function itself won't change {@link this.extendedProject}; the caller should set it using
    // the promise returned from this function.
    private async loadSelectedProject(): Promise<ExtendedProject | undefined> {
        const selectedProject = this.project.selected;

        if (selectedProject) {
            const extendedWorkbench = await this.extendedWorkbench.getValue();
            if (this.workbench.selected && extendedWorkbench) {
                this.loading.next(true);
                logger.debug(`Loading project '${selectedProject.name}' using thrift...`);
                try {
                    return extendedWorkbench.loadProject(selectedProject);
                } catch (e) {
                    if (typeof e === "string" || e instanceof Error) {
                        Vscode.window.showErrorMessage(`IAR: Error while loading the project. Some functionality may be unavailable (${e.toString()}).`);
                        logger.error(`Error loading project '${selectedProject.name}': ${e.toString()}`);
                    }
                    return undefined;
                }
            } else {
                logger.debug(`Not loading project '${selectedProject.name}' using thrift, no appropriate workbench selected...`);
                return undefined;
            }
        } else {
            return undefined;
        }
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
