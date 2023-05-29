/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Assert from "assert";
import * as Path from "path";
import { CpptoolsIntellisenseService } from "../../src/extension/intellisense/cpptoolsintellisenseservice";
import { ExtensionState } from "../../src/extension/extensionstate";
import { WorkbenchFeatures } from "../../src/iar/tools/workbenchfeatureregistry";
import { FsUtils } from "../../src/utils/fs";
import { TestConfiguration } from "../testconfiguration";
import { VscodeTestsSetup } from "./setup";
import { VscodeTestsUtils } from "./utils";

/**
 * Tests various parts of the extension using a project that requires a .custom_argvars file to be loaded.
 */
suite("Test .custom_argvars project support", () => {
    let sandBoxDir: string;

    suiteSetup(async function() {
        await VscodeTestsUtils.doExtensionSetup();
        sandBoxDir = VscodeTestsSetup.setup();
    });

    setup(function() {
        console.log("\n==========================================================" + this.currentTest!.title + "==========================================================\n");
    });

    test("Can load project with .custom_argvars", async function() {
        if (!TestConfiguration.getConfiguration().testThriftSupport) {
            this.skip();
        }
        if (!WorkbenchFeatures.supportsFeature(ExtensionState.getInstance().workbench.selected!, WorkbenchFeatures.PMWorkspaces)) {
            this.skip();
        }
        await VscodeTestsUtils.activateWorkspace("ArgVars1");
        await new Promise((res) => setTimeout(res, 1000));
        {
            const project = await ExtensionState.getInstance().extendedProject.getValue();
            Assert(project);
            const rootNode = await project.getRootNode();
            Assert.strictEqual(rootNode.children[0]?.name, "Fibonacci.c", "Incorrect file name, argvars may not have been loaded correctly");
        }

        await VscodeTestsUtils.activateWorkspace("ArgVars2");
        await new Promise((res) => setTimeout(res, 1000));
        {
            const project = await ExtensionState.getInstance().extendedProject.getValue();
            Assert(project);
            const rootNode = await project.getRootNode();
            Assert.strictEqual(rootNode.children[0]?.name, "NewFileName.c", "Incorrect file name, argvars may not have been loaded correctly");
        }
    });
    test("Can build project with .custom_argvars", async function() {
        this.timeout(40000);
        await VscodeTestsUtils.activateWorkspace("ArgVars1");
        await VscodeTestsUtils.runTaskForProject("Build Project", "ArgVars", "Debug");
        const exeFile = Path.join(sandBoxDir, "ArgVars/Debug/Exe/ArgVars.out");
        Assert(await FsUtils.exists(exeFile), `Expected ${exeFile} to exist`);
    });
    test("Source config provider handles project with .custom_argvars", async function() {
        this.timeout(80000);
        await VscodeTestsUtils.activateWorkspace("ArgVars1");
        // Make sure the source configuration has updated before proceeding
        await CpptoolsIntellisenseService.instance?.forceUpdate();
        Assert(CpptoolsIntellisenseService.instance);
        // It is enough to test that it generates a configuration at all, since we already test elsewhere that
        // the configuration is correct.
        Assert(CpptoolsIntellisenseService.instance.canHandleFile(Path.join(sandBoxDir, "ArgVars/Fibonacci.c")));
    });
});