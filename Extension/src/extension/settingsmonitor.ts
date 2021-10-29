/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import { Workbench } from "../iar/tools/workbench";
import { ListInputModel, InputModel } from "./model/model";
import { Settings } from "./settings";
import { Compiler } from "../iar/tools/compiler";
import { Project } from "../iar/project/project";
import { Config } from "../iar/project/config";

export namespace SettingsMonitor {
    export function monitorWorkbench(model: ListInputModel<Workbench>): void {
        model.addOnSelectedHandler(onWorkbenchChanged);
        onWorkbenchChanged(model);
    }
    export function monitorCompiler(model: ListInputModel<Compiler>): void {
        model.addOnSelectedHandler(onCompilerChanged);
        onCompilerChanged(model);
    }
    export function monitorProject(model: ListInputModel<Project>): void {
        model.addOnSelectedHandler(onProjectChanged);
        onProjectChanged(model);
    }
    export function monitorConfiguration(model: ListInputModel<Config>): void {
        model.addOnSelectedHandler(onConfigurationChanged);
        onConfigurationChanged(model);
    }

    function onWorkbenchChanged(model: InputModel<Workbench>): void {
        if (model.selected) {
            Settings.setWorkbench(model.selected.path);
        }
    }

    function onCompilerChanged(model: InputModel<Compiler>): void {
        if (model.selected) {
            Settings.setCompiler(model.selected.path);
        }
    }

    function onProjectChanged(model: InputModel<Project>): void {
        if (model.selected) {
            Settings.setEwpFile(model.selected.path);
        }
    }

    function onConfigurationChanged(model: InputModel<Config>): void {
        if (model.selected) {
            Settings.setConfiguration(model.selected.name);
        }
    }
}
