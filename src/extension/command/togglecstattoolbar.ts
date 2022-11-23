/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Settings } from "../settings";
import { CommandBase } from "./command";

/**
 * Toggles the row of C-STAT buttons in the extension's 'toolbar'.
 */
export class ToggleCstatToolbarCommand extends CommandBase<void> {
    private static readonly ID = "iar-build.toggleCstatToolbar";

    constructor() {
        super(ToggleCstatToolbarCommand.ID);
    }

    executeImpl() {
        const currentValue = Settings.getCstatShowInToolbar();
        Settings.setCstatShowInToolbar(!currentValue);
    }
}
