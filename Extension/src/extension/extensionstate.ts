/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import { ToolManager } from "../iar/tools/manager";
import { WorkbenchListModel } from "./model/selectworkbench";
import { Settings } from "./settings";
import { ListInputModel } from "./model/model";
import { Project, LoadedProject, ExtendedProject } from "../iar/project/project";
import { ProjectListModel } from "./model/selectproject";
import { ConfigurationListModel } from "./model/selectconfiguration";
import { EwpFile } from "../iar/project/parsing/ewpfile";
import { ExtendedWorkbench, ThriftWorkbench } from "../iar/extendedworkbench";
import { AsyncObservable } from "./model/asyncobservable";

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

    // The currently loaded project, if any. Only one project can be loaded at a time.
    readonly loadedProject: AsyncObservable<LoadedProject>;
    // If the selected project can also be loaded as an ExtendedProject (thrift-enabled), it will be provided here
    readonly extendedProject: AsyncObservable<ExtendedProject>;
    // If the selected workbench has extended (majestix) capabilities, it will be provided here
    readonly extendedWorkbench: AsyncObservable<ExtendedWorkbench>;

    constructor(toolManager: ToolManager) {
        this.toolManager = toolManager;

        this.workbench = new WorkbenchListModel(...[]);
        this.coupleModelToSetting(this.workbench, Settings.LocalSettingsField.Workbench, workbench => workbench?.path.toString());

        let projects: Project[] = [];
        if (Vscode.workspace.rootPath) {
            projects = Project.findProjectsIn(Vscode.workspace.rootPath, true);
        }
        this.project = new ProjectListModel(...projects);
        this.coupleModelToSetting(this.project, Settings.LocalSettingsField.Ewp, project => project?.path.toString());

        this.config = new ConfigurationListModel(...[]);
        this.coupleModelToSetting(this.config, Settings.LocalSettingsField.Configuration, config => config?.name);

        this.loadedProject = new AsyncObservable<LoadedProject>();
        this.extendedProject = new AsyncObservable<ExtendedProject>();
        this.extendedWorkbench = new AsyncObservable<ExtendedWorkbench>();


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

    // Connects a list model to a persistable setting in the iar-vsc.json file, so that:
    // * Changes to the model are stored in the file.
    // * When the list contents change, tries to restore the selected value from the file.
    // This means that selected values are remembered between sessions
    private coupleModelToSetting<T>(model: ListInputModel<T>, field: Settings.LocalSettingsField, toSettingsValue: (val: T | undefined) => string | undefined) {
        const setFromStoredValue = () => {
            const settingsValue = Settings.getLocalSetting(field);
            if (settingsValue) {
                if (!model.selectWhen(item => settingsValue === toSettingsValue(item)) && model.amount > 0) {
                    Vscode.window.showWarningMessage(`IAR: Can't find '${settingsValue}' (defined in iar-vsc.json).`);
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
        this.addProjectContentListeners();

        this.addWorkbenchModelListeners();
        this.addProjectModelListeners();
        this.addConfigurationModelListeners();
    }

    private addToolManagerListeners(): void {
        this.toolManager.addInvalidateListener(() => {
            this.workbench.set(...this.toolManager.workbenches);
        });
    }

    private addProjectContentListeners(): void {
        this.loadedProject.onValueDidChange(project => {
            project?.onChanged(() => {
                this.config.set(...project.configurations);
            });
        });
    }

    private addWorkbenchModelListeners(): void {
        this.workbench.addOnSelectedHandler(async workbench => {
            const prevExtWb = await this.extendedWorkbench.getValue();
            const selectedWb = workbench.selected;

            if (selectedWb) {
                this.extendedWorkbench.setWithPromise((async() => {
                    if (ThriftWorkbench.hasThriftSupport(selectedWb)) {
                        try {
                            return await ThriftWorkbench.from(selectedWb);
                        } catch (e) {
                            if (typeof e === "string" || e instanceof Error) {
                                Vscode.window.showErrorMessage(`IAR: Error initiating workbench backend. Some functionality may be unavailable (${e.toString()}).`);
                            }
                            return undefined;
                        }
                    } else {
                        return undefined;
                    }
                })());
                // Make sure the workbench has finished loading before we continue (and dispose of the previous workbench)
                await this.extendedWorkbench.getValue();
            } else {
                this.extendedWorkbench.setValue(undefined);
            }
            prevExtWb?.dispose();
        });

        this.extendedWorkbench.onValueDidChange(_exWb => {
            this.loadProject();
        });
        this.extendedWorkbench.onValueDidChange(exWb => {
            if (exWb) {
                exWb.onCrash(exitCode => {
                    Vscode.window.showErrorMessage(`IAR: The project manager exited unexpectedly (code ${exitCode}). Try reloading the window or upgrading the project from Embedded Workbench.`);
                    this.extendedWorkbench.setValue(undefined);
                });
            }
        });
    }

    private addProjectModelListeners(): void {
        this.project.addOnSelectedHandler(() => {
            // Clear stored config, since it is only valid for the old project
            Settings.setConfiguration("");
            this.config.set(...[]);

            this.loadProject();
        });

        this.loadedProject.onValueDidChange(project => {

            this.config.useConfigurationsFromProject(project);
        });
    }

    private addConfigurationModelListeners(): void {
        // Nothing to do here
    }

    private async loadProject() {
        const prevProj = await this.loadedProject.getValue();
        prevProj?.unload();
        const selectedProject = this.project.selected;

        if (selectedProject) {
            const extendedWorkbench = await this.extendedWorkbench.getValue();
            if (this.workbench.selected && extendedWorkbench) {
                const exProject = this.loadExtendedProject(selectedProject, extendedWorkbench);

                this.extendedProject.setWithPromise(exProject);
                this.loadedProject.setWithPromise(exProject.catch(() => new EwpFile(selectedProject.path)));
                await this.loadedProject.getValue();
            } else {
                this.loadedProject.setValue(new EwpFile(selectedProject.path));
                this.extendedProject.setValue(undefined);
            }
        } else {
            this.loadedProject.setValue(undefined);
            this.extendedProject.setValue(undefined);
        }
    }

    private async loadExtendedProject(project: Project, exWorkbench: ExtendedWorkbench): Promise<ExtendedProject> {
        try {
            return await exWorkbench.loadProject(project);
        } catch (e) {
            // TODO: consider displaying more error information when the project manager starts providing specific errors
            if (typeof e === "string" || e instanceof Error) {
                Vscode.window.showErrorMessage(`IAR: Error while loading the project. Some functionality may be unavailable (${e.toString()}).`);
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
