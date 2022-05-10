/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as path from "path";
import * as utils from "iar-vsc-common/testutils/testUtils";

export function run(): Promise<void> {
    const testsRoot = path.resolve(__dirname);
    return utils.getTestPromise(testsRoot, 20000);
}
