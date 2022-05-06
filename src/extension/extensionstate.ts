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
import { InformationDialog, InformationDialogType } from "./ui/informationdialog";
import { WorkbenchVersions } from "../iar/tools/workbenchversionregistry";
import { logger } from "iar-vsc-common/logger";

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

        this.extendedProject = new AsyncObservable<ExtendedProject>();
        this.extendedWorkbench = new AsyncObservable<ExtendedWorkbench>();


        this.coupleModelToSetting(this.workbench, Settings.LocalSettingsField.Workbench, workbench => workbench?.path.toString());
        this.coupleModelToSetting(this.project, Settings.LocalSettingsField.Ewp, project => project?.path.toString());
        this.coupleModelToSetting(this.config, Settings.LocalSettingsField.Configuration, config => config?.name);

        this.addListeners();
    }

    public async dispose(): Promise<void> {
        const extendedProject = await this.extendedProject.getValue();
        if (extendedProject) {
            extendedProject.unload();
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
            await extWorkbench.unloadProject(extProject);
        }
        await this.loadProject();
    }

    // Connects a list model to a persistable setting in the iar-vsc.json file, so that:
    // * Changes to the model are stored in the file.
    // * When the list contents change, tries to restore the selected value from the file.
    // This means that selected values are remembered between sessions
    private coupleModelToSetting<T>(model: ListInputModel<T>, field: Settings.LocalSettingsField, toSettingsValue: (val: T | undefined) => string | undefined) {
        const setFromStoredValue = () => {
            const settingsValue = Settings.getLocalSetting(field);
            if (settingsValue) {
                if (!model.selectWhen(item => settingsValue === toSettingsValue(item)) && model.amount > 0) {
                    logger.debug(`Could not match item to ${field}: ${settingsValue} in iar-vsc.json`);
                    model.select(0);
                }
            } else {
                model.select(0);
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
        this.addToolManagerListeners();

        this.addWorkbenchModelListeners();
        this.addProjectModelListeners();
        this.addConfigurationModelListeners();
    }

    private addToolManagerListeners(): void {
        this.toolManager.addInvalidateListener(() => {
            this.workbench.set(...this.toolManager.workbenches);
        });
    }

    private addWorkbenchModelListeners(): void {
        // Try to load thrift services for the new workbench
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
            // Unload the previous project and reload it with the new workbench. Only after can we dispose of the previous workbench.
            await this.loadProject();
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
                    this.loadProject();
                });
            }
        });

        this.workbench.addOnSelectedHandler(model => {
            if (model.selected !== undefined && !WorkbenchVersions.doCheck(model.selected, WorkbenchVersions.supportsVSCode)) {
                const minVersions = WorkbenchVersions.getMinProductVersions(model.selected, WorkbenchVersions.supportsVSCode);
                InformationDialog.show(
                    "unsupportedWorkbench",
                    "The selected IAR toolchain is not supported by this extension." + (minVersions.length > 0 ? ` The minimum supported version is ${minVersions.join(", ")}.`: ""),
                    InformationDialogType.Error);
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

            this.loadProject();
        });

        this.extendedProject.onValueDidChange(project => {
            logger.debug(`Loaded extended project '${project?.name}'`);
            this.loading.next(false);
        });
    }

    private addConfigurationModelListeners(): void {
        this.config.addOnSelectedHandler(async() => {
            logger.debug(`Configuration: selected '${this.config.selected?.name}' (index ${this.config.selectedIndex})`);
            // Check that the configuration target is supported by the selected workbench.
            const selected = this.config.selected;
            const extWb = await this.extendedWorkbench.getValue();
            if (selected && extWb) {
                const toolchains = await extWb.getToolchains();
                if (!toolchains.some(tc => tc.id === selected.toolchainId)) {
                    Vscode.window.showErrorMessage(`The target '${selected.toolchainId}' is not supported by the selected IAR toolchain. Please select a different toolchain.`);
                }
            }
        });
    }

    // Loads a project using the appropriate method depending on whether an extended workbench
    // is available. Any previously loaded project is unloaded.
    private async loadProject() {
        this.extendedProject.promise.then(project => project?.unload());
        const selectedProject = this.project.selected;

        if (selectedProject) {
            const extendedWorkbench = await this.extendedWorkbench.getValue();
            if (this.workbench.selected && extendedWorkbench) {
                this.loading.next(true);
                logger.debug(`Loading project '${selectedProject.name}' using thrift...`);
                const exProject = this.loadExtendedProject(selectedProject, extendedWorkbench);

                this.extendedProject.setWithPromise(exProject.catch(() => undefined));
                await this.extendedProject.getValue();
            } else {
                logger.debug(`Not loading project '${selectedProject.name}' using thrift, no appropriate workbench selected...`);
                this.extendedProject.setValue(undefined);
            }
        } else {
            this.extendedProject.setValue(undefined);
        }
    }

    private loadExtendedProject(project: Project, exWorkbench: ExtendedWorkbench): Promise<ExtendedProject> {
        try {
            return exWorkbench.loadProject(project);
        } catch (e) {
            if (typeof e === "string" || e instanceof Error) {
                Vscode.window.showErrorMessage(`IAR: Error while loading the project. Some functionality may be unavailable (${e.toString()}).`);
                logger.error(`Error loading project '${project.name}': ${e.toString()}`);
            }
            return Promise.reject(e);
        }
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
