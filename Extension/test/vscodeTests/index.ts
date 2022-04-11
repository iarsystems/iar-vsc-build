/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as path from "path";
import { deactivate } from "../../src/extension/main";
import * as utils from "../../utils/testutils/testUtils";

export async function run(): Promise<void> {
    const testsRoot = path.resolve(__dirname);
    await utils.getTestPromise(testsRoot, 20000);
    // Since these tests activate the extension, we should deactivate it afterwards to ensure
    // e.g. the service launcher is disposed of. Otherwise, the test process hangs under some circumstances.
    // TODO: investigate whether deactivate is supported to be called by vs code here.
    deactivate();
}
