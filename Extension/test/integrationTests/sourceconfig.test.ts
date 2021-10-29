/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Assert from "assert";
import { ToolManager } from "../../src/iar/tools/manager";
import { Settings } from "../../src/extension/settings";
import { EwpFile } from "../../src/iar/project/parsing/ewpfile";
import { StaticConfigGenerator } from "../../src/extension/configprovider/staticconfiggenerator";
import { Compiler } from "../../src/iar/tools/compiler";
import { DynamicConfigGenerator } from "../../src/extension/configprovider/dynamicconfiggenerator";
import { Workbench } from "../../src/iar/tools/workbench";
import * as vscode from "vscode";
import { IntegrationTestsCommon } from "./common";
import { TestSandbox } from "../../utils/testutils/testSandbox";
import * as Path from "path";

suite("Test source configuration providers", function() {
    this.timeout(0);

    let workbench: Workbench;
    let armCompiler: Compiler;
    let sandbox: TestSandbox;
    let projectDir: string;
    let project: EwpFile;

    suiteSetup(() => {
        const manager = ToolManager.createIarToolManager();
        Settings.getIarInstallDirectories().forEach(directory => {
            manager.collectFrom(directory);
        });

        const workbenches = manager.findWorkbenchesContainingPlatform("arm");
        Assert(workbenches && workbenches.length > 0, "These tests require an ARM EW to run, but none was found.");
        workbench = workbenches[0];
        armCompiler = workbench.platforms.find(p => p.path.toString().endsWith("arm"))!.compilers[0];

        sandbox = new TestSandbox(IntegrationTestsCommon.PROJECT_ROOT);
        projectDir = sandbox.copyToSandbox(IntegrationTestsCommon.TEST_PROJECTS_DIR, "SourceConfigTests");
        project = new EwpFile(Path.join(projectDir, IntegrationTestsCommon.TEST_PROJECT_NAME));
    });

    suiteTeardown(() => {
        project.unload();
    });

    test("Finds project wide configs", async() => {
        const config = await StaticConfigGenerator.generateConfiguration("c", project.findConfiguration("Debug"), project, undefined);
        Assert(config.includes.some(path => path.path.toString() === "my\\test\\include\\path"));
        Assert(config.includes.some(path => path.path.toString() === "my/other/include/path"));
        Assert(config.defines.some(define => define.identifier === "MY_SYMBOL" && define.value === "42"));
        Assert(config.defines.some(define => define.identifier === "MY_SYMBOL2" && define.value === "\"test\""));
    });

    test("Finds compiler configs", async() => {
        const config = await StaticConfigGenerator.generateConfiguration("c", undefined, undefined, armCompiler);
        Assert(config.includes.some(path => path.absolutePath.toString().match(/arm[/\\]inc[/\\]/)));
        Assert(config.includes.some(path => path.absolutePath.toString().match(/arm[/\\]inc[/\\]c[/\\]aarch32/)));
        Assert(config.defines.some(define => define.identifier === "__thumb"));
        Assert(config.defines.some(define => define.identifier === "__VERSION__"));
    });


    test("Finds c++ configs", async() => {
        const config = await StaticConfigGenerator.generateConfiguration("cpp", undefined, undefined, armCompiler);
        Assert(config.includes.some(path => path.absolutePath.toString().endsWith("cpp")), "Does not include c++ header directory");
        // Assumes this define is always there, but might not be if using an old c++ standard?
        Assert(config.defines.some(define => define.identifier === "__cpp_constexpr"), "Does not include c++ defines");
    });

    test("Finds file specific configs", async() => {
        const generator = new DynamicConfigGenerator();
        await generator.generateConfiguration(workbench, project, armCompiler, project.findConfiguration("Debug")!);
        const projectFile = Path.join(projectDir, IntegrationTestsCommon.TEST_PROJECT_SOURCE_FILE);
        const includes = generator.getIncludes(vscode.Uri.file(projectFile));
        Assert.equal(includes.map(path => path.path), ["only/this/file"]);
        const defines = generator.getDefines(vscode.Uri.file(projectFile));
        Assert.equal(defines.map(def => def.identifier), ["FILE_SYMBOL"]);
    });
});