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
import path = require("path");

suite("Test Public TS Api", ()=>{
    let api: BuildExtensionApi;
    let ledFlasherPath: string;
    let basicDebuggingPath: string;

    suiteSetup(async function() {
        console.log("TS API tests");
        this.timeout(50000);
        await VscodeTestsUtils.ensureExtensionIsActivated();
        VscodeTestsSetup.setup();
        api = Vscode.extensions.getExtension("iarsystems.iar-build")!.exports;

        const sandboxPath = VscodeTestsSetup.setup();
        ledFlasherPath = Path.join(sandboxPath, "SourceConfiguration/IAR-STM32F429II-EXP/LedFlasher/LedFlasher.ewp");
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
            await VscodeTestsUtils.activateProject("LedFlasher");
            const projPath = await api.getSelectedProject();
            Assert.strictEqual(projPath, ledFlasherPath);
        }
        {
            await VscodeTestsUtils.activateProject("BasicDebugging");
            const projPath = await api.getSelectedProject();
            Assert.strictEqual(projPath, basicDebuggingPath);
        }
    });

    test("Returns current configuration", async() => {
        {
            await VscodeTestsUtils.activateProject("LedFlasher");
            const config = await api.getSelectedConfiguration(ledFlasherPath);
            Assert.strictEqual(config?.name, "Flash Debug");
            Assert.strictEqual(config?.target, "ARM");
        }
        {
            await VscodeTestsUtils.activateProject("BasicDebugging");
            await VscodeTestsUtils.activateConfiguration("Release");
            const config = await api.getSelectedConfiguration(basicDebuggingPath);
            Assert.strictEqual(config?.name, "Release");
            Assert.strictEqual(config?.target, "ARM");
        }
    });
    test("Returns project configurations", async() => {
        {
            await VscodeTestsUtils.activateProject("LedFlasher");
            const configs = await api.getProjectConfigurations(ledFlasherPath);
            Assert.strictEqual(configs?.[0]?.name, "Flash Debug");
            Assert.strictEqual(configs?.[0]?.target, "ARM");
        }
        {
            await VscodeTestsUtils.activateProject("BasicDebugging");
            await VscodeTestsUtils.activateConfiguration("Release");
            const configs = await api.getProjectConfigurations(basicDebuggingPath);
            Assert.strictEqual(configs?.[0]?.name, "Debug");
            Assert.strictEqual(configs?.[0]?.target, "ARM");
            Assert.strictEqual(configs?.[1]?.name, "Release");
            Assert.strictEqual(configs?.[1]?.target, "ARM");
        }
    });

    test("Returns cspy arguments", async() => {
        await VscodeTestsUtils.activateProject("BasicDebugging");
        const commands = await api.getCSpyCommandline(basicDebuggingPath, "Debug");
        const expectedCommands = [
            "/file",
            path.join(path.dirname(basicDebuggingPath), "Debug/Exe/BasicDebugging.out"),
            "--crun=disabled",
            "--endian=little",
            "--cpu=ARM7TDMI",
            "/runto",
            "main",
            "--fpu=None",
            "--semihosting",
            "--multicore_nr_of_cores=1",
            "/driver",
            Path.join(ExtensionState.getInstance().workbench.selected!.path, "arm\\bin\\armSIM2.dll"),
            "/proc",
            Path.join(ExtensionState.getInstance().workbench.selected!.path, "arm\\bin\\armPROC.dll"),
            "/plugin",
            Path.join(ExtensionState.getInstance().workbench.selected!.path, "arm\\bin\\armlibsupport.dll"),
            "/kernel",
            "kernel.dll",
            "/ilink"
        ];
        Assert.deepStrictEqual(commands, expectedCommands);
    });
});
