
'use strict';

import * as Vscode from "vscode";
import { ToolManager } from "../../iar/tools/manager";
import { WorkbenchListModel } from "../model/selectworkbench";
import { SelectWorkbenchCommand } from "../command/selectworkbench";
import { SelectionView } from "./selectionview";
import { Settings } from "../settings";
import { Command } from "../command/command";
import { Workbench } from "../../iar/tools/workbench";

type WorkbenchUi = {
    model: WorkbenchListModel,
    cmd: Command,
    ui: SelectionView<Workbench>
};

class Application {
    private toolManager: ToolManager;
    private context: Vscode.ExtensionContext;

    readonly workbench: WorkbenchUi;

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

    private createWorkbenchUi(): WorkbenchUi {
        let model = new WorkbenchListModel(...this.toolManager.workbenches);
        let cmd = SelectWorkbenchCommand.createCommand(model);
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
            let model = this.workbench.model;

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
        this.workbench.model.set(...manager.workbenches);

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
