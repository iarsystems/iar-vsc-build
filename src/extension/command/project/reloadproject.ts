/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as vscode from "vscode";
import { logger } from "iar-vsc-common/logger";
import { ErrorUtils } from "../../../utils/utils";
import { ExtensionState } from "../../extensionstate";
import { CommandBase } from "../command";

export class ReloadProjectCommand extends CommandBase<Promise<void>> {

    constructor() {
        super("iar-build.reloadProject");
    }

    async executeImpl(_autoTriggered?: boolean): Promise<void> {
        const workspace = await ExtensionState.getInstance().workspace.getValue();
        const activeProject = workspace?.projects.selected;
        try {
            await activeProject?.reload();
        } catch (e) {
            const errMsg = ErrorUtils.toErrorMessage(e);
            logger.error(`Failed to reload project '${activeProject?.name}': ${errMsg}`);
            vscode.window.showErrorMessage(`Failed to reload project '${activeProject?.name}': ${errMsg}`);
        }
    }
}