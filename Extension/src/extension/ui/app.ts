/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import { ToolManager } from "../../iar/tools/manager";
import { WorkbenchListModel } from "../model/selectworkbench";
import { SelectionView } from "./selectionview";
import { Settings } from "../settings";
import { Command } from "../command/command";
import { Command as RegenerateCommand } from "../command/regeneratecpptoolsconf";
import { Workbench } from "../../iar/tools/workbench";
import { CompilerListModel } from "../model/selectcompiler";
import { ListInputModel } from "../model/model";
import { Compiler } from "../../iar/tools/compiler";
import { Project, LoadedProject, ExtendedProject } from "../../iar/project/project";
import { ProjectListModel } from "../model/selectproject";
import { Config } from "../../iar/project/config";
import { ConfigurationListModel } from "../model/selectconfiguration";
import { SelectIarWorkspace } from "../command/selectIarWorkspace";
import { TreeSelectionView } from "./treeselectionview";
import { IarConfigurationProvider } from "../configprovider/configurationprovider";
import { TreeProjectView } from "./treeprojectview";
import { CreateProjectCommand } from "../command/project/createproject";
import { AddConfigCommand } from "../command/project/addconfig";
import { RemoveConfigCommand } from "../command/project/removeconfig";
import { RemoveNodeCommand } from "../command/project/removenode";
import { AddNodeCommand } from "../command/project/addnode";
import { SingletonModel } from "../model/singletonmodel";
import { EwpFile } from "../../iar/project/parsing/ewpfile";
import { ExtendedWorkbench, ThriftWorkbench } from "../../iar/extendedworkbench";
import { ReloadProjectCommand } from "../command/project/reloadproject";

type UI<T> = {
    model: ListInputModel<T>,
    cmd: Command,
    ui: SelectionView<T>
};

class Application {
    private toolManager: ToolManager;
    private context: Vscode.ExtensionContext;

    readonly workbench: UI<Workbench>;
    readonly compiler: UI<Compiler>;
    readonly config: UI<Config>;
    readonly project: UI<Project>;

    // 'loadedProject' provides the selected project after it has been loaded (e.g. when its configurations have been parsed)
    readonly loadedProject: SingletonModel<LoadedProject>;
    // if the selected project can also be loaded as an ExtendedProject, it will be provided by 'extendedProject'
    readonly extendedProject: SingletonModel<ExtendedProject>;
    // if the selected workbench has extended capabilities, it will be provided here
    readonly extendedWorkbench: SingletonModel<ExtendedWorkbench>;

    readonly projectTreeProvider: TreeProjectView;
    readonly projectTreeView: Vscode.TreeView<any>;
    readonly settingsTreeView: TreeSelectionView;

    readonly generator: Command;
    readonly selectIarWorkspace: Command;

    //private cppToolsProvider: IarConfigurationProvider | undefined;

    constructor(context: Vscode.ExtensionContext, toolManager: ToolManager) {
        this.context = context;
        this.toolManager = toolManager;

        // create different UIs
        this.workbench = this.createWorkbenchUi();
        this.compiler = this.createCompilerUi();
        this.hideHelper(this.compiler); // Should not be needed when using thrift PM
        this.project = this.createProjectUi();
        this.config = this.createConfigurationUi();

        this.loadedProject = new SingletonModel<LoadedProject>();
        this.extendedProject = new SingletonModel<ExtendedProject>();
        this.extendedWorkbench = new SingletonModel<ExtendedWorkbench>();

        this.settingsTreeView = new TreeSelectionView(context,
                                                        this.workbench.model,
                                                        this.compiler.model,
                                                        this.project.model,
                                                        this.config.model);
        Vscode.window.registerTreeDataProvider('iar-settings', this.settingsTreeView);

        this.projectTreeProvider = new TreeProjectView(this.extendedProject);                                                                                        
        // Vscode.window.registerTreeDataProvider("iar-project", this.projectTree);
        this.projectTreeView = Vscode.window.createTreeView("iar-project", { treeDataProvider: this.projectTreeProvider });

        // Create commands without UI
        this.generator = RegenerateCommand.createRegenerateCppToolsConfig(this.compiler.model as CompilerListModel,
            this.config.model as ConfigurationListModel);
        this.generator.register(context);

        this.selectIarWorkspace = new SelectIarWorkspace();
        this.selectIarWorkspace.register(context);

        new CreateProjectCommand().register(context);
        new ReloadProjectCommand().register(context);
        new AddConfigCommand().register(context);
        new RemoveConfigCommand().register(context);
        new RemoveNodeCommand().register(context);
        new AddNodeCommand().register(context);

        // add listeners
        this.addListeners();

        // update UIs with current selected settings
        this.selectCurrentSettings();

        // TODO: load project if selected

        // TODO: move somewhere else
        this.extendedProject.addOnSelectedHandler((_model, project) => {
            if (project) {
                this.hideHelper(this.compiler);
                this.settingsTreeView.setCompilerVisible(false);
            } else {
                this.showHelper(this.compiler);
                this.settingsTreeView.setCompilerVisible(true);
            }
        })
    }

    public show(): void {
        this.showHelper(this.workbench);
        this.showHelper(this.compiler);
        this.showHelper(this.project);
        this.showHelper(this.config);

        this.generator.enabled = true;
    }

    public hide(): void {
        this.generator.enabled = false;

        this.hideHelper(this.workbench);
        this.hideHelper(this.compiler);
        this.hideHelper(this.project);
        this.hideHelper(this.config);
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

    private hideHelper<T>(element: UI<T>) {
        element.cmd.enabled = false;
        element.ui.hide();
    }

    private createWorkbenchUi(): UI<Workbench> {
        let model = new WorkbenchListModel(...this.toolManager.workbenches);
        let cmd = Command.createSelectWorkbenchCommand(model);
        let ui = SelectionView.createSelectionView(cmd, model, 5);

        cmd.register(this.context);
        ui.label = "Workbench: ";
        ui.defaultText = "None selected";

        return {
            model: model,
            cmd: cmd,
            ui: ui
        };
    }

    private createCompilerUi(): UI<Compiler> {
        let model = new CompilerListModel();
        let cmd = Command.createSelectCompilerCommand(model);
        let ui = SelectionView.createSelectionView(cmd, model, 4);

        cmd.register(this.context);
        ui.label = "Compiler: ";
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

        let model = new ProjectListModel(...projects);
        let cmd = Command.createSelectProjectCommand(model);
        let ui = SelectionView.createSelectionView(cmd, model, 3);

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
        let configs: ReadonlyArray<Config> = [];

        let model = new ConfigurationListModel(...configs);
        let cmd = Command.createSelectConfigurationCommand(model);
        let ui = SelectionView.createSelectionView(cmd, model, 2);

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
        this.selectCurrentCompiler();
        this.selectCurrentProject();
        this.selectCurrentConfiguration();
    }

    private selectCurrentWorkbench(): void {
        let currentWorkbench = Settings.getWorkbench();

        if (currentWorkbench) {
            const currentWorkbenchPath = currentWorkbench.toString();
            let model = this.workbench.model as WorkbenchListModel;

            if (!model.selectWhen(workbench => workbench.path === currentWorkbenchPath) && model.amount > 0) {
                Vscode.window.showWarningMessage(`IAR: Can't find the workbench '${currentWorkbench}' (defined in iar-vsc.json).`);
                this.workbench.model.select(0);
            }
        } else {
            this.workbench.model.select(0);
        }
    }

    private selectCurrentCompiler(): void {
        let currentCompiler = Settings.getCompiler();

        if (currentCompiler) {
            const currentCompilerPath = currentCompiler.toString();
            let model = this.compiler.model as CompilerListModel;

            if (!model.selectWhen(compiler => compiler.path === currentCompilerPath) && model.amount > 0) {
                Vscode.window.showWarningMessage(`IAR: Can't find the compiler '${currentCompiler}' (defined in iar-vsc.json).`);
                this.compiler.model.select(0);
            }
        } else {
            this.compiler.model.select(0);
        }

    }

    private selectCurrentProject(): void {
        let currentProject = Settings.getEwpFile();

        if (currentProject) {
            const currentProjPath = currentProject.toString();
            let model = this.project.model as ProjectListModel;

            if (!model.selectWhen(proj => proj.path === currentProjPath) && model.amount > 0) {
                Vscode.window.showWarningMessage(`IAR: Can't find the project '${currentProject}' (defined in iar-vsc.json).`);
                this.project.model.select(0);
            }
        } else {
            this.project.model.select(0);
        }

    }

    private selectCurrentConfiguration(): void {
        let currentConfiguration = Settings.getConfiguration();

        if (currentConfiguration) {
            let model = this.config.model as ConfigurationListModel;

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
        this.addCompilerModelListeners();

        this.addProjectModelListeners();
        this.addConfigurationModelListeners();
    }

    private addToolManagerListeners(): void {
        this.toolManager.addInvalidateListener(() => {
            let model = this.workbench.model as WorkbenchListModel;

            model.set(...this.toolManager.workbenches);
        });
    }

    private addProjectContentListeners(): void {
        let model = this.loadedProject;

        model.addOnSelectedHandler((_model, project) => {
            project?.onChanged(() => {
                let configModel = this.config.model as ConfigurationListModel;

                configModel.set(...project.configurations);
            });
        });
    }

    private addWorkbenchModelListeners(): void {
        let model = this.workbench.model as WorkbenchListModel;

        model.addOnInvalidateHandler(() => {
            this.selectCurrentWorkbench();
        });

        model.addOnSelectedHandler(() => {
            let compilerModel = this.compiler.model as CompilerListModel;

            compilerModel.useCompilersFromWorkbench(model.selected);
        });

        // TODO: handle potential race when selecting project and workbench at the same time
        model.addOnSelectedHandler(async workbench => {
            const prevExtWb = this.extendedWorkbench.selected;
            const selectedWb = workbench.selected;

            if (selectedWb) {
                if (ThriftWorkbench.hasThriftSupport(selectedWb)) {
                    this.extendedWorkbench.selected = await ThriftWorkbench.from(selectedWb);
                } else {
                    this.extendedWorkbench.selected = undefined;
                }
            }
            this.loadProject();
            prevExtWb?.dispose();
        });
    }

    private addCompilerModelListeners(): void {
        let model = this.compiler.model as CompilerListModel;

        model.addOnInvalidateHandler(() => {
            this.selectCurrentCompiler();
        });
    }

    private addProjectModelListeners(): void {
        let model = this.project.model as ProjectListModel;

        model.addOnInvalidateHandler(() => {
            this.selectCurrentProject();
        });
        model.addOnSelectedHandler(() => {
        });

        model.addOnSelectedHandler(() => {
            this.projectTreeView.title = model.selected ? model.selected.name : "IAR Project";
        });
        model.addOnSelectedHandler(() => {
            this.loadProject();
        });

        this.loadedProject.addOnSelectedHandler(() => {
            let configModel = this.config.model as ConfigurationListModel;

            configModel.useConfigurationsFromProject(this.loadedProject.selected);
        });
    }

    private addConfigurationModelListeners(): void {
        let model = this.config.model as ConfigurationListModel;

        model.addOnInvalidateHandler(() => {
            this.selectCurrentConfiguration();
        });
    }

    private async loadProject() {
        const prevProject = this.loadedProject.selected;
        const selectedProject = this.project.model.selected;
        if (selectedProject) {
            if (this.workbench.model.selected && this.extendedWorkbench.selected) {
                try {
                    this.extendedProject.selected = await this.extendedWorkbench.selected.loadProject(selectedProject);
                    this.loadedProject.selected = this.extendedProject.selected;
                } catch (e) {
                    // TODO: consider displaying more error information when the project manager starts providing specific errors
                    Vscode.window.showErrorMessage(`IAR: Error while loading the project. Some functionality may be unavailable (${e.toString()}).`);
                    this.loadedProject.selected = new EwpFile(selectedProject.path);
                    this.extendedProject.selected = undefined;
                }
            } else {
                this.loadedProject.selected = new EwpFile(selectedProject.path);
                this.extendedProject.selected = undefined;
            }
            IarConfigurationProvider.instance?.forceUpdate();
        } else {
            this.loadedProject.selected = undefined;
            this.extendedProject.selected = undefined;
        }
        prevProject?.unload();
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
