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
        return Promise.resolve(ExtensionState.getInstance().workbenches.selected?.path.toString());
    },

    async getSelectedConfiguration(projectPath) {
        const workspace = await ExtensionState.getInstance().workspace.getValue();
        const selectedPath = workspace?.projects.selected?.path;
        if (selectedPath && OsUtils.pathsEqual(projectPath, selectedPath)) {
            const config = workspace.getActiveConfig();
            if (config) {
                return Promise.resolve({ name: config.name, target: config.targetId });
            }
        }
        return Promise.resolve(undefined);
    },

    async getProjectConfigurations(projectPath) {
        const workspace = await ExtensionState.getInstance().workspace.getValue();
        const selectedProject = workspace?.projects.selected;
        if (selectedProject && OsUtils.pathsEqual(projectPath, selectedProject.path)) {
            return Promise.resolve(selectedProject.configurations.map(c => {
                return { name: c.name, target: c.targetId };
            }));
        }
        return Promise.resolve(undefined);
    },

    async getSelectedProject() {
        const workspace = await ExtensionState.getInstance().workspace.getValue();
        return workspace?.projects.selected?.path.toString();
    },

    async getCSpyCommandline(projectPath, configuration) {
        const workspace = await ExtensionState.getInstance().workspace.getValue();
        const project = workspace?.projects.items.find(proj => OsUtils.pathsEqual(proj.path, projectPath));
        if (workspace?.isExtendedWorkspace() && project) {
            const extendedProject = await workspace.getExtendedProject(project);
            return extendedProject?.getCSpyArguments(configuration);
        }
        return undefined;
    },
};
