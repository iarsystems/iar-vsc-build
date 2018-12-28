
'use strict';

import { WorkbenchListModel } from "./model/selectworkbench";
import { Workbench } from "../iar/tools/workbench";
import { ListInputModel } from "./model/model";
import { Settings } from "./settings";

export namespace SettingsMonitor {
    export function monitor(workbenches: WorkbenchListModel) {
        workbenches.addOnSelectedHandler(onWorkbenchChanged);
    }

    function onWorkbenchChanged(model: ListInputModel<Workbench>): void {
        if (model.selected) {
            Settings.setWorkbench(model.selected.path);
        }
    }
}
