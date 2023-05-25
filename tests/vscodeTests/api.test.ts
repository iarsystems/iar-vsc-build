/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import * as Vscode from "vscode";
import * as Path from "path";
import * as Assert from "assert";
import { VscodeTestsUtils } from "./utils";
import { VscodeTestsSetup } from "./setup";
import { OsUtils } from "iar-vsc-common/osUtils";
import { ExtensionState } from "../../src/extension/extensionstate";
import { BuildExtensionApi } from "iar-vsc-common/buildExtension";
import { TestConfiguration } from "../testconfiguration";

suite("Test Public TS Api", function() {
    let api: BuildExtensionApi;
    let sourceConfigPath: string;
    let basicDebuggingPath: string;

    suiteSetup(async function() {
        console.log("TS API tests");
        this.timeout(50000);
        await VscodeTestsUtils.doExtensionSetup();
        VscodeTestsSetup.setup();
        api = Vscode.extensions.getExtension("iarsystems.iar-build")!.exports;

        const sandboxPath = VscodeTestsSetup.setup();
        sourceConfigPath = Path.join(sandboxPath, "SourceConfiguration/Project/SourceConfiguration.ewp");
        basicDebuggingPath = Path.join(sandboxPath, "GettingStarted/BasicDebugging.ewp");
        // Wait for a project to be loaded (this means both the workbench and project has settled)
        await ExtensionState.getInstance().extendedProject.getValue();
    });

    setup(function() {
        console.log("\n==========================================================" + this.currentTest!.title + "==========================================================\n");
    });

    test("Returns current workbench", async() => {
        const apiPath = await api.getSelectedWorkbench();
        Assert.notStrictEqual(apiPath, undefined);
        Assert(OsUtils.pathsEqual(ExtensionState.getInstance().workbench.selected!.path.toString(), apiPath!), "The api did not returned the correct EW path: " + apiPath);
    });

    test("Returns loaded project", async() => {
        {
            await VscodeTestsUtils.activateProject("SourceConfiguration");
            const projPath = await api.getSelectedProject();
            Assert(projPath);
            Assert(OsUtils.pathsEqual(projPath, sourceConfigPath), `Incorrect path: ${projPath}`);
        }
        {
            await VscodeTestsUtils.activateProject("BasicDebugging");
            const projPath = await api.getSelectedProject();
            Assert(projPath);
            Assert(OsUtils.pathsEqual(projPath, basicDebuggingPath), `Incorrect path: ${projPath}`);
        }
    });

    test("Returns current configuration", async() => {
        {
            await VscodeTestsUtils.activateProject("SourceConfiguration");
            const config = await api.getSelectedConfiguration(sourceConfigPath);
            Assert.strictEqual(config?.name, "TheConfiguration");
            Assert.strictEqual(config?.target, TestConfiguration.getConfiguration().target);
        }
        {
            await VscodeTestsUtils.activateProject("BasicDebugging");
            await VscodeTestsUtils.activateConfiguration("Release");
            const config = await api.getSelectedConfiguration(basicDebuggingPath);
            Assert.strictEqual(config?.name, "Release");
            Assert.strictEqual(config?.target, TestConfiguration.getConfiguration().target);
        }
    });
    test("Returns project configurations", async() => {
        {
            await VscodeTestsUtils.activateProject("SourceConfiguration");
            const configs = await api.getProjectConfigurations(sourceConfigPath);
            Assert.strictEqual(configs?.[0]?.name, "TheConfiguration");
            Assert.strictEqual(configs?.[0]?.target, TestConfiguration.getConfiguration().target);
        }
        {
            await VscodeTestsUtils.activateProject("BasicDebugging");
            await VscodeTestsUtils.activateConfiguration("Release");
            const configs = await api.getProjectConfigurations(basicDebuggingPath);
            Assert.strictEqual(configs?.[0]?.name, "Debug");
            Assert.strictEqual(configs?.[0]?.target, TestConfiguration.getConfiguration().target);
            Assert.strictEqual(configs?.[1]?.name, "Release");
            Assert.strictEqual(configs?.[1]?.target, TestConfiguration.getConfiguration().target);
        }
    });

    test("Returns cspy arguments", async function() {
        if (TestConfiguration.getConfiguration().cspyCommandLine === undefined) {
            this.skip();
            return;
        }
        await VscodeTestsUtils.activateProject("BasicDebugging");
        const commands = await api.getCSpyCommandline(basicDebuggingPath, "Debug");
        const expectedCommands = TestConfiguration.getConfiguration().cspyCommandLine?.(ExtensionState.getInstance().workbench.selected!.path, basicDebuggingPath);
        Assert(commands);
        Assert(expectedCommands);

        const assertionMsg = `Expected:\n  ${JSON.stringify(expectedCommands, null, 2)}\n` +
            `Got:\n  ${JSON.stringify(commands, null, 2)}`;

        Assert.strictEqual(commands.length, expectedCommands.length, assertionMsg);
        for (let i = 0; i < commands.length; i++) {
            const expectedCommand: string | { path: string } = expectedCommands[i]!;
            if (typeof expectedCommand === "string") {
                Assert.strictEqual(commands[i], expectedCommand, assertionMsg +
                                    `\nMismatch in entry ${i}.`);
            } else {
                Assert(OsUtils.pathsEqual(commands[i]!, expectedCommand.path), assertionMsg +
                                   `\nMismatch in entry ${i}. Expected:\n  ${expectedCommands[i]}\n` +
                                   `which is not path-equal to the actual value:\n  ${commands[i]}`);
            }
        }
    });
});
