/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import * as Vscode from "vscode";
import * as Path from "path";
import * as Fs from "fs/promises";
import * as Assert from "assert";
import { VscodeTestsUtils } from "./utils";
import { VscodeTestsSetup } from "./setup";
import { ExtensionState } from "../../src/extension/extensionstate";
import { TestConfiguration } from "../testconfiguration";
import { CpptoolsIntellisenseService } from "../../src/extension/intellisense/cpptoolsintellisenseservice";

suite("Test CMake integration", function() {
    let cmakeProjectDir: string;

    suiteSetup(async function() {
        console.log("CMake integration tests");
        if (!TestConfiguration.getConfiguration().testCMakeIntegration) {
            this.skip();
            return;
        }
        await VscodeTestsUtils.doExtensionSetup();
        VscodeTestsSetup.setup();

        const sandboxPath = VscodeTestsSetup.setup();
        cmakeProjectDir = Path.join(sandboxPath, "CMakeProject/");
        await VscodeTestsUtils.activateWorkspace("TestProjects");
        await VscodeTestsUtils.activateProject("CMakeProject");
    });

    setup(function() {
        console.log("\n==========================================================" + this.currentTest!.title + "==========================================================\n");
    });

    test("Can load project", async() => {
        const expectedConfigNames = ["Debug", "RelWithDebInfo"];
        {
            const configNames = ExtensionState.getInstance().config.configurations.map(conf => conf.name);
            Assert.deepStrictEqual(configNames, expectedConfigNames);
        }

        const loadedProject = await ExtensionState.getInstance().extendedProject.getValue();
        Assert(loadedProject);
        const configNames = loadedProject.configurations.map(conf => conf.name);
        Assert.deepStrictEqual(configNames, expectedConfigNames);

        const rootNode = await loadedProject.getRootNode();
        const targetGroup = rootNode.children.find(child => child.name === "SimpleProject [Executable]");
        Assert(targetGroup, "Found no group named 'SimpleProject [Executable]'");
        Assert(targetGroup.children.some(child => child.name === "main.c"));
    });

    test("Can build project", async() => {
        await VscodeTestsUtils.runTaskForProject("Build Project", "CMakeProject", "Debug");
    });

    test("Can provide source configuration", async() => {
        const provider = CpptoolsIntellisenseService.instance;
        const mainFile = Path.join(cmakeProjectDir, "main.c");
        Assert(provider!.canHandleFile(mainFile));

        const config = (await provider!.provideConfigurations([Vscode.Uri.file(mainFile)]))[0];
        Assert(config?.configuration.defines.some(def => def === "_MYDEFINE=42"));
    });

    test("Responds to control file changes", async() => {
        const cmakelistsPath = Path.join(cmakeProjectDir, "CMakeLists.txt");
        const contents = (await Fs.readFile(cmakelistsPath)).toString();
        const newContents = contents.
            replace(/set\(CMAKE_CONFIGURATION_TYPES .*\)/, "set(CMAKE_CONFIGURATION_TYPES NewConfig)").
            replace(/add_executable\((.*)\)/, "add_executable($1 secondfile.c)");
        await Fs.writeFile(cmakelistsPath, newContents);

        // Give vs code time to react to the file change
        await new Promise((p, _) => setTimeout(p, 3000));
        const loadedProject = await ExtensionState.getInstance().extendedProject.getValue();
        Assert(loadedProject);

        const configNames = loadedProject.configurations.map(conf => conf.name);
        Assert.deepStrictEqual(configNames, ["NewConfig"]);

        const rootNode = await loadedProject.getRootNode();
        Assert(rootNode.children.some(child => child.name === "secondfile.c"));
    });

});
