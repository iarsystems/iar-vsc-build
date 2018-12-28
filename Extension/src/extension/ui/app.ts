
'use strict';

import * as Vscode from "vscode";
import { ToolManager } from "../../iar/tools/manager";
import { WorkbenchListModel } from "../model/selectworkbench";
import { SelectWorkbenchCommand } from "../command/selectworkbench";
import { SelectionView } from "./selectionview";

export namespace UI {
    export function createUi(manager: ToolManager, context: Vscode.ExtensionContext) {
        let wbModel = new WorkbenchListModel(...manager.workbenches);
        let cmd = SelectWorkbenchCommand.createCommand(wbModel);
        let ui = SelectionView.createSelectionView(cmd, wbModel, 1);

        cmd.register(context);
        ui.label = "Workbench: ";
        ui.defaultText = "None selected";
        ui.show();

        manager.addInvalidateListener(toolManager => {
            wbModel.setWorkbenches(...toolManager.workbenches);
        });
    }
}
