
'use strict';

import { Workbench } from "../iar/tools/workbench";
import { ListInputModel } from "./model/model";
import { Settings } from "./settings";
import { Compiler } from "../iar/tools/compiler";
import { Project } from "../iar/project/project";
import { Config } from "../iar/project/config";

export namespace SettingsMonitor {
    export function monitorWorkbench(model: ListInputModel<Workbench>): void {
        model.addOnSelectedHandler(onWorkbenchChanged);
    }
    export function monitorCompiler(model: ListInputModel<Compiler>): void {
        model.addOnSelectedHandler(onCompilerChanged);
    }
    export function monitorProject(model: ListInputModel<Project>): void {
        model.addOnSelectedHandler(onProjectChanged);
    }
    export function monitorConfiguration(model: ListInputModel<Config>): void {
        model.addOnSelectedHandler(onConfigurationChanged);
    }

    function onWorkbenchChanged(model: ListInputModel<Workbench>): void {
        if (model.selected) {
            Settings.setWorkbench(model.selected.path);
        }
    }

    function onCompilerChanged(model: ListInputModel<Compiler>): void {
        if (model.selected) {
            Settings.setCompiler(model.selected.path);
        }
    }

    function onProjectChanged(model: ListInputModel<Project>): void {
        if (model.selected) {
            Settings.setEwpFile(model.selected.path);
        }
    }

    function onConfigurationChanged(model: ListInputModel<Config>): void {
        if (model.selected) {
            Settings.setConfiguration(model.selected.name);
        }
    }
}
