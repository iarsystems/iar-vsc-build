/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import * as path from "path";
import { Settings } from "../../src/extension/settings";
import { IarToolManager } from "../../src/iar/tools/manager";
import * as fs from "fs";

export namespace IntegrationTestsCommon {
    // Root folder of the extension project
    export const PROJECT_ROOT = path.join(__dirname, "../../../");
    // Name of the test project
    export const TEST_PROJECT_NAME = "test_project.ewp";
    // Name of the only file in the test project
    export const TEST_PROJECT_SOURCE_FILE = "main.c";

    export async function findWorkbenchesContainingTarget(target: string) {
        const manager = new IarToolManager();
        await manager.collectWorkbenches(Settings.getIarInstallDirectories(), false);

        return manager.workbenches.filter(wb => {
            return fs.existsSync(path.join(wb.path.toString(), target));
        });
    }
}