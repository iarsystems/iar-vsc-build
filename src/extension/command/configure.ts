/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ExtensionState } from "../extensionstate";
import { IarVsc } from "../main";
import { CMAKE_CMSIS_LOG_NAME } from "../ui/logservicehandler";
import { CommandBase } from "./command";

/**
 * Configures a selected CMake or CMSIS-Toolbox project
 */
export class ConfigureCommand extends CommandBase<void> {
    public static readonly ID = "iar-build.configure";

    constructor() {
        super(ConfigureCommand.ID);
    }

    async executeImpl() {
        const workspace = await ExtensionState.getInstance().workspace.getValue();
        if (workspace?.isExtendedWorkspace()) {
            const project = await workspace.getExtendedProject();
            if (project) {
                IarVsc.outputChannelProvider.getOutputChannel(CMAKE_CMSIS_LOG_NAME).show(true);
                await project.configure();
            }
        }
    }
}

/**
 * Force reconfigures a selected CMake or CMSIS-Toolbox project
 */
export class ReconfigureCommand extends CommandBase<void> {
    public static readonly ID = "iar-build.reconfigure";

    constructor() {
        super(ReconfigureCommand.ID);
    }

    async executeImpl() {
        const workspace = await ExtensionState.getInstance().workspace.getValue();
        if (workspace?.isExtendedWorkspace()) {
            const project = await workspace.getExtendedProject();
            if (project) {
                IarVsc.outputChannelProvider.getOutputChannel(CMAKE_CMSIS_LOG_NAME).show(true);
                await project.reconfigure();
            }
        }
    }
}
