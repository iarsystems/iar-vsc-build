/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { BuildExtensionApi } from "iar-vsc-common/buildExtension";
import { OsUtils } from "iar-vsc-common/osUtils";
import { ExtensionState } from "./extensionstate";

/**
 * The public typescript API that is accessible to other extensions, see {@link BuildExtensionApi}.
 */
export const API: BuildExtensionApi = {

    getSelectedWorkbench() {
        return Promise.resolve(ExtensionState.getInstance().workbench.selected?.path.toString());
    },

    getSelectedConfiguration(projectPath) {
        const selectedPath = ExtensionState.getInstance().project.selected?.path.toString();
        if (selectedPath && OsUtils.pathsEqual(projectPath, selectedPath)) {
            const config = ExtensionState.getInstance().config.selected;
            if (config) {
                return Promise.resolve({ name: config.name, target: config.toolchainId });
            }
        }
        return Promise.resolve(undefined);
    },

    getProjectConfigurations(projectPath) {
        const selectedPath = ExtensionState.getInstance().project.selected?.path.toString();
        if (selectedPath && OsUtils.pathsEqual(projectPath, selectedPath)) {
            return Promise.resolve(ExtensionState.getInstance().config.configurations.map(c => {
                return { name: c.name, target: c.toolchainId };
            }));
        }
        return Promise.resolve(undefined);
    },

    getSelectedProject() {
        return Promise.resolve(ExtensionState.getInstance().project.selected?.path.toString());
    },

    async getCSpyCommandline(projectPath, configuration) {
        const project = await ExtensionState.getInstance().extendedProject.getValue();
        if (project === undefined || !OsUtils.pathsEqual(projectPath, project.path.toString())) {
            return undefined;
        }
        return project.getCSpyArguments(configuration);
    },
};
