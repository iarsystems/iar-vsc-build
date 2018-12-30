
'use strict';

import * as Vscode from "vscode";
import { ToolManager } from "../../iar/tools/manager";
import { WorkbenchListModel } from "../model/selectworkbench";
import { SelectionView } from "./selectionview";
import { Settings } from "../settings";
import { Command } from "../command/command";
import { Command as GenerateCommand } from "../command/generatecpptoolsconf";
import { Command as OpenWorkbenchCommand } from "../command/openworkbench";
import { Workbench } from "../../iar/tools/workbench";
import { CompilerListModel } from "../model/selectcompiler";
import { ListInputModel } from "../model/model";
import { Compiler } from "../../iar/tools/compiler";
import { Project } from "../../iar/project/project";
import { ProjectListModel } from "../model/selectproject";
import { Config } from "../../iar/project/config";
import { ConfigurationListModel } from "../model/selectconfiguration";

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
    readonly project: UI<Project>;
    readonly config: UI<Config>;

    readonly generator: Command;
    readonly openWorkbench: Command;

    constructor(context: Vscode.ExtensionContext, toolManager: ToolManager) {
        this.context = context;
        this.toolManager = toolManager;

        // create different UIs
        this.workbench = this.createWorkbenchUi();
        this.compiler = this.createCompilerUi();
        this.project = this.createProjectUi();
        this.config = this.createConfigurationUi();

        // Create commands without UI
        this.generator = GenerateCommand.createGenerateCppToolsConfig(this.compiler.model as CompilerListModel,
            this.config.model as ConfigurationListModel);
        this.generator.register(context);

        this.openWorkbench = OpenWorkbenchCommand.createOpenWorkbenchCommand(this.workbench.model as WorkbenchListModel);
        this.openWorkbench.register(context);

        // add listeners
        this.addListeners();

        // update UIs with current selected settings
        this.selectCurrentSettings();
    }

    public show(): void {
        this.showHelper(this.workbench);
        this.showHelper(this.compiler);
        this.showHelper(this.project);
        this.showHelper(this.config);

        this.generator.enabled = true;
        this.openWorkbench.enabled = true;
    }

    public hide(): void {
        this.generator.enabled = false;
        this.openWorkbench.enabled = false;

        this.hideHelper(this.workbench);
        this.hideHelper(this.compiler);
        this.hideHelper(this.project);
        this.hideHelper(this.config);
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
            projects = Project.createProjectsFrom(Vscode.workspace.rootPath, true);
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

        let project = this.project.model.selected;

        if (project) {
            configs = project.configurations;
        }

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

    private generateOutput(): void {
        if (this.generator.enabled) {
            this.generator.execute();
        }
    }

    private selectCurrentSettings(): void {
        this.selectCurrentWorkbench();
        this.selectCurrentCompiler();
        this.selectCurrentProject();
        this.selectCurrenConfiguration();
    }

    private selectCurrentWorkbench(): void {
        let currentWorkbench = Settings.getWorkbench();

        if (currentWorkbench) {
            let model = this.workbench.model as WorkbenchListModel;

            model.workbenches.some((workbench, index): boolean => {
                if (!currentWorkbench) {
                    return true;
                }

                if (workbench.path === currentWorkbench.toString()) {
                    model.select(index);
                    return true;
                } else {
                    return false;
                }
            });
        }
    }

    private selectCurrentCompiler(): void {
        let currentCompiler = Settings.getCompiler();

        if (currentCompiler) {
            let model = this.compiler.model as CompilerListModel;

            model.compilers.some((compiler, index): boolean => {
                if (!currentCompiler) {
                    return true;
                }

                if (compiler.path === currentCompiler.toString()) {
                    model.select(index);
                    return true;
                } else {
                    return false;
                }
            });
        }
    }

    private selectCurrentProject(): void {
        let currentProject = Settings.getEwpFile();

        if (currentProject) {
            let model = this.project.model as ProjectListModel;

            model.projects.some((project, index): boolean => {
                if (!currentProject) {
                    return true;
                }

                if (project.path === currentProject.toString()) {
                    model.select(index);
                    return true;
                } else {
                    return false;
                }
            });
        }
    }

    private selectCurrenConfiguration(): void {
        let currentConfiguration = Settings.getConfiguration();

        if (currentConfiguration) {
            let model = this.config.model as ConfigurationListModel;

            model.configurations.some((config, index): boolean => {
                if (!currentConfiguration) {
                    return true;
                }

                if (config.name === currentConfiguration) {
                    model.select(index);
                    return true;
                } else {
                    return false;
                }
            });
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
        let model = this.project.model as ProjectListModel;

        model.projects.forEach(project => {
            project.onChanged(() => {
                if (project === model.selected) {
                    let configModel = this.config.model as ConfigurationListModel;

                    configModel.set(...project.configurations);
                }
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
    }

    private addCompilerModelListeners(): void {
        let model = this.compiler.model as CompilerListModel;

        model.addOnInvalidateHandler(() => {
            this.selectCurrentCompiler();
        });

        model.addOnSelectedHandler(() => {
            this.generateOutput();
        });
    }

    private addProjectModelListeners(): void {
        let model = this.project.model as ProjectListModel;

        model.addOnInvalidateHandler(() => {
            this.selectCurrentProject();
        });
        model.addOnSelectedHandler(() => {
            let configModel = this.config.model as ConfigurationListModel;

            configModel.useConfigurationsFromProject(model.selected);
        });
    }

    private addConfigurationModelListeners(): void {
        let model = this.config.model as ConfigurationListModel;

        model.addOnInvalidateHandler(() => {
            this.selectCurrenConfiguration();
        });

        model.addOnSelectedHandler(() => {
            this.generateOutput();
        });
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
