/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { IarVsc } from "./main";

/**
 * Extension-specific utility functions (see `src/utils` for general/standalone
 * utility functions).
 */
export namespace ExtensionUtils {

    /**
     * Waits for workbenches/toolchains to be loaded. This is useful for API
     * functions and commands that may be called immediately after the extension
     * is activated, but need to wait workbenches and/or projects to be loaded
     * before they can proceed.
     */
    export function ensureWorkbenchesDiscovered(): Promise<void> {
        if (IarVsc.workbenchesLoading.value) {
            return new Promise(resolve => {
                IarVsc.workbenchesLoading.subscribe(loading => {
                    if (!loading) {
                        resolve();
                    }
                });
            });
        }
        return Promise.resolve();
    }
}