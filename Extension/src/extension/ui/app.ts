
'use strict';

import * as Vscode from "vscode";
import { ToolManager } from "../../iar/tools/manager";
import { WorkbenchListModel } from "../model/selectworkbench";
import { SelectionView } from "./selectionview";
import { Settings } from "../settings";
import { Command } from "../command/command";
import { Workbench } from "../../iar/tools/workbench";
import { ListInputModel } from "../model/model";

type UI<T> = {
    model: ListInputModel<T>,
    cmd: Command,
    ui: SelectionView<T>
};

class Application {
    private toolManager: ToolManager;
    private context: Vscode.ExtensionContext;

    readonly workbench: UI<Workbench>;

    constructor(context: Vscode.ExtensionContext, toolManager: ToolManager) {
        this.context = context;
        this.toolManager = toolManager;

        // create different UIs
        this.workbench = this.createWorkbenchUi();

        // add listeners
        this.toolManager.addInvalidateListener(this.onWorbenchesChanged, this);

        // update UIs with current selected settings
        this.selectCurrentSettings();
    }

    public show(): void {
        this.workbench.ui.show();
    }

    private createWorkbenchUi(): UI<Workbench> {
        let model = new WorkbenchListModel(...this.toolManager.workbenches);
        let cmd = Command.createSelectWorkbenchCommand(model);
        let ui = SelectionView.createSelectionView(cmd, model, 1);

        cmd.register(this.context);
        ui.label = "Workbench: ";
        ui.defaultText = "None selected";

        return {
            model: model,
            cmd: cmd,
            ui: ui
        };
    }

    private selectCurrentSettings(): void {
        this.selectCurrentWorkbench();
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

    private onWorbenchesChanged(manager: ToolManager): void {
        let model = this.workbench.model as WorkbenchListModel;

        model.set(...manager.workbenches);

        this.selectCurrentWorkbench();
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
