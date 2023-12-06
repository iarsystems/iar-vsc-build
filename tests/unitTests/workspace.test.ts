/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Assert from "assert";
import * as path from "path";
import { EwwFile } from "../../src/iar/workspace/ewwfile";
import { OsUtils } from "iar-vsc-common/osUtils";

const TEST_WORKSPACE_FILE = path.resolve(__dirname, "../../../tests/unitTests/assets/test_workspace.eww");
const TEST_PROJECT_FILE = path.resolve(__dirname, "../../../tests/unitTests/assets/test_project.ewp");

suite("Test workspace parser", () => {
    test("Load eww file", async() => {
        const workspace = new EwwFile(TEST_WORKSPACE_FILE);

        Assert.strictEqual(workspace.name, "test_workspace");
        Assert(OsUtils.pathsEqual(workspace.path, TEST_WORKSPACE_FILE));

        const projects = await EwwFile.getMemberProjects(workspace.path);
        Assert.strictEqual(projects.length, 2);

        Assert(OsUtils.pathsEqual(projects[0]!, TEST_PROJECT_FILE));
        Assert.strictEqual(projects[1], "/home/nonexistent.ewp");
    });
});