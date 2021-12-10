/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import { ToolManager } from "../../iar/tools/manager";
import { WorkbenchListModel } from "../model/selectworkbench";
import { SelectionView } from "./selectionview";
import { Settings } from "../settings";
import { Command } from "../command/command";
import { Command as RegenerateCommand } from "../command/regeneratecpptoolsconf";
import { Workbench } from "../../iar/tools/workbench";
import { ListInputModel } from "../model/model";
import { Project, LoadedProject, ExtendedProject } from "../../iar/project/project";
import { ProjectListModel } from "../model/selectproject";
import { Config } from "../../iar/project/config";
import { ConfigurationListModel } from "../model/selectconfiguration";
import { SelectIarWorkspace } from "../command/selectIarWorkspace";
import { TreeSelectionView } from "./treeselectionview";
import { TreeProjectView } from "./treeprojectview";
import { CreateProjectCommand } from "../command/project/createproject";
import { AddConfigCommand } from "../command/project/addconfig";
import { RemoveConfigCommand } from "../command/project/removeconfig";
import { RemoveNodeCommand } from "../command/project/removenode";
import { AddFileCommand, AddGroupCommand } from "../command/project/addnode";
import { SingletonModel } from "../model/singletonmodel";
import { EwpFile } from "../../iar/project/parsing/ewpfile";
import { ExtendedWorkbench, ThriftWorkbench } from "../../iar/extendedworkbench";
import { ReloadProjectCommand } from "../command/project/reloadproject";

/**
 * A clickable UI element allowing the user to select one of several items in a list
 */
interface UI<T> {
    model: ListInputModel<T>, // The data being selected from
    cmd: Command<void>,    // The command used to select an item
    ui: SelectionView<T> // The UI element
}

class Application {
    private readonly toolManager: ToolManager;
    private readonly context: Vscode.ExtensionContext;

    readonly workbench: UI<Workbench>;
    readonly config: UI<Config>;
    readonly project: UI<Project>;

    // 'loadedProject' provides the selected project after it has been loaded (e.g. when its configurations have been parsed)
    readonly loadedProject: SingletonModel<LoadedProject>;
    // if the selected project can also be loaded as an ExtendedProject, it will be provided by 'extendedProject'
    readonly extendedProject: SingletonModel<ExtendedProject>;
    // if the selected workbench has extended capabilities, it will be provided here
    readonly extendedWorkbench: SingletonModel<ExtendedWorkbench>;

    readonly projectTreeView: TreeProjectView;
    readonly settingsTreeView: TreeSelectionView;

    readonly generator: Command<unknown>;

    constructor(context: Vscode.ExtensionContext, toolManager: ToolManager) {
        this.context = context;
        this.toolManager = toolManager;

        // create different UIs
        this.workbench = this.createWorkbenchUi();
        this.project = this.createProjectUi();
        this.config = this.createConfigurationUi();

        this.loadedProject = new SingletonModel<LoadedProject>();
        this.extendedProject = new SingletonModel<ExtendedProject>();
        this.extendedWorkbench = new SingletonModel<ExtendedWorkbench>();

        this.settingsTreeView = new TreeSelectionView(context,
            this.workbench.model,
            this.project.model,
            this.config.model);
        Vscode.window.registerTreeDataProvider("iar-settings", this.settingsTreeView);

        this.projectTreeView = new TreeProjectView(this.project.model, this.extendedProject, this.workbench.model, this.extendedWorkbench);

        // Create commands
        this.generator = RegenerateCommand.createRegenerateCppToolsConfig();
        this.generator.register(context);

        new SelectIarWorkspace().register(context);
        new CreateProjectCommand().register(context);
        new ReloadProjectCommand().register(context);
        new AddConfigCommand().register(context);
        new RemoveConfigCommand().register(context);
        new RemoveNodeCommand().register(context);
        new AddFileCommand().register(context);
        new AddGroupCommand().register(context);

        // add listeners
        this.addListeners();

        // update UIs with current selected settings
        this.selectCurrentSettings();

    }

    public show(): void {
        this.showHelper(this.workbench);
        this.showHelper(this.project);
        this.showHelper(this.config);
    }

    public dispose(): void {
        if (this.extendedProject.selected) {
            this.extendedProject.selected.unload();
        }
        if (this.extendedWorkbench.selected) {
            this.extendedWorkbench.selected.dispose();
        }
    }

    private showHelper<T>(element: UI<T>) {
        element.ui.show();
        element.cmd.enabled = true;
    }

    private createWorkbenchUi(): UI<Workbench> {
        const model = new WorkbenchListModel(...this.toolManager.workbenches);
        const cmd = Command.createSelectWorkbenchCommand(model);
        const ui = SelectionView.createSelectionView(cmd, model, 5);

        cmd.register(this.context);
        ui.label = "Workbench: ";
        ui.defaultText = "None selected";

        return {
            model: model,
            cmd: cmd,
            ui: ui
        };
    }

    private createProjectUi(): UI<Project> {
        let projects: Project[] = [];
        if (Vscode.workspace.rootPath) {
            projects = Project.findProjectsIn(Vscode.workspace.rootPath, true);
        }

        const model = new ProjectListModel(...projects);
        const cmd = Command.createSelectProjectCommand(model);
        const ui = SelectionView.createSelectionView(cmd, model, 3);

        cmd.register(this.context);
        ui.label = "Project: ";
        ui.defaultText = "None selected";

        return {
            model: model,
            cmd: cmd,
            ui: ui
        };
    }

    private createConfigurationUi(): UI<Config> {
        const configs: ReadonlyArray<Config> = [];

        const model = new ConfigurationListModel(...configs);
        const cmd = Command.createSelectConfigurationCommand(model);
        const ui = SelectionView.createSelectionView(cmd, model, 2);

        cmd.register(this.context);
        ui.label = "Configuration: ";
        ui.defaultText = "None selected";

        return {
            model: model,
            cmd: cmd,
            ui: ui
        };
    }

    private selectCurrentSettings(): void {
        this.selectCurrentWorkbench();
        this.selectCurrentProject();
        this.selectCurrentConfiguration();
    }

    private selectCurrentWorkbench(): void {
        const currentWorkbench = Settings.getWorkbench();

        if (currentWorkbench) {
            const currentWorkbenchPath = currentWorkbench.toString();
            const model = this.workbench.model as WorkbenchListModel;

            if (!model.selectWhen(workbench => workbench.path === currentWorkbenchPath) && model.amount > 0) {
                Vscode.window.showWarningMessage(`IAR: Can't find the workbench '${currentWorkbench}' (defined in iar-vsc.json).`);
                this.workbench.model.select(0);
            }
        } else {
            this.workbench.model.select(0);
        }
    }

    private selectCurrentProject(): void {
        const currentProject = Settings.getEwpFile();

        if (currentProject) {
            const currentProjPath = currentProject.toString();
            const model = this.project.model as ProjectListModel;

            if (!model.selectWhen(proj => proj.path === currentProjPath) && model.amount > 0) {
                Vscode.window.showWarningMessage(`IAR: Can't find the project '${currentProject}' (defined in iar-vsc.json).`);
                this.project.model.select(0);
            }
        } else {
            this.project.model.select(0);
        }

    }

    private selectCurrentConfiguration(): void {
        const currentConfiguration = Settings.getConfiguration();

        if (currentConfiguration) {
            const model = this.config.model as ConfigurationListModel;

            if (!model.selectWhen(config => config.name === currentConfiguration) && model.amount > 0) {
                Vscode.window.showWarningMessage(`IAR: Can't find the configuration '${currentConfiguration}' (defined in iar-vsc.json).`);
                this.config.model.select(0);
            }
        } else {
            this.config.model.select(0);
        }

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
            const model = this.workbench.model as WorkbenchListModel;

            model.set(...this.toolManager.workbenches);
        });
    }

    private addProjectContentListeners(): void {
        const model = this.loadedProject;

        model.addOnSelectedHandler((_model, project) => {
            project?.onChanged(() => {
                const configModel = this.config.model as ConfigurationListModel;

                configModel.set(...project.configurations);
            });
        });
    }

    private addWorkbenchModelListeners(): void {
        const model = this.workbench.model as WorkbenchListModel;

        model.addOnInvalidateHandler(() => {
            this.selectCurrentWorkbench();
        });

        model.addOnSelectedHandler(async workbench => {
            const prevExtWb = this.extendedWorkbench.selected;
            const selectedWb = workbench.selected;

            if (selectedWb) {
                this.extendedWorkbench.selectedPromise = (async() => {
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
                })();
                // Make sure the workbench has finished loading before we continue (and dispose of the previous workbench)
                await this.extendedWorkbench.selectedPromise;
            } else {
                this.extendedWorkbench.selected = undefined;
            }
            prevExtWb?.dispose();
        });

        this.extendedWorkbench.addOnSelectedHandler((_model, _exWb) => {
            this.loadProject();
        });
    }

    private addProjectModelListeners(): void {
        const model = this.project.model as ProjectListModel;

        model.addOnInvalidateHandler(() => {
            this.selectCurrentProject();
        });

        model.addOnSelectedHandler(() => {
            this.loadProject();
        });

        this.loadedProject.addOnSelectedHandler(() => {
            const configModel = this.config.model as ConfigurationListModel;

            configModel.useConfigurationsFromProject(this.loadedProject.selected);
        });
    }

    private addConfigurationModelListeners(): void {
        const model = this.config.model as ConfigurationListModel;

        model.addOnInvalidateHandler(() => {
            this.selectCurrentConfiguration();
        });
    }

    private async loadProject() {
        this.loadedProject.selectedPromise.then(proj => proj?.unload());
        const selectedProject = this.project.model.selected;

        if (selectedProject) {
            const extendedWorkbench = await this.extendedWorkbench.selectedPromise;
            if (this.workbench.model.selected && extendedWorkbench) {
                const exProject = this.loadExtendedProject(selectedProject, extendedWorkbench);

                this.extendedProject.selectedPromise = exProject;
                this.loadedProject.selectedPromise = exProject.catch(() => new EwpFile(selectedProject.path));
                await this.loadedProject.selectedPromise;
            } else {
                this.loadedProject.selected = new EwpFile(selectedProject.path);
                this.extendedProject.selected = undefined;
            }
        } else {
            this.loadedProject.selected = undefined;
            this.extendedProject.selected = undefined;
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

export namespace UI {
    let app: Application | undefined = undefined;

    export function init(context: Vscode.ExtensionContext, manager: ToolManager) {
        app = new Application(context, manager);
    }

    export function getInstance(): Application {
        if (!app) {
            throw new Error("UI not yet initialized.");
        }

        return app;
    }
}
