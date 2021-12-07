/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Assert from "assert";
import { EwpFile } from "../../src/iar/project/parsing/ewpfile";
import { DynamicConfigGenerator } from "../../src/extension/configprovider/dynamicconfiggenerator";
import { Workbench } from "../../src/iar/tools/workbench";
import * as vscode from "vscode";
import { IntegrationTestsCommon } from "./common";
import { TestSandbox } from "../../utils/testutils/testSandbox";
import * as Path from "path";
import { IarOsUtils } from "../../utils/osUtils";

suite("Test source configuration providers", function() {
    this.timeout(0);

    let workbench: Workbench;
    let armCompiler: string;
    let sandbox: TestSandbox;
    let projectDir: string;
    let project: EwpFile;

    suiteSetup(() => {
        const workbenches = IntegrationTestsCommon.findWorkbenchesContainingTarget("arm");
        Assert(workbenches && workbenches.length > 0, "These tests require an ARM EW to run, but none was found.");
        workbench = workbenches[0]!;
        armCompiler = Path.join(workbench.path.toString(), "arm/bin/iccarm" + IarOsUtils.executableExtension());

        sandbox = new TestSandbox(IntegrationTestsCommon.PROJECT_ROOT);
        projectDir = sandbox.copyToSandbox(IntegrationTestsCommon.TEST_PROJECTS_DIR, "SourceConfigTests");
        project = new EwpFile(Path.join(projectDir, IntegrationTestsCommon.TEST_PROJECT_NAME));
        Assert(project.findConfiguration("Debug"), "Test project should have a Debug configuration");
    });

    suiteTeardown(() => {
        project.unload();
    });

    test("Finds project wide configs", async() => {
        const config = await new DynamicConfigGenerator().generateConfiguration(workbench, project, armCompiler, project.findConfiguration("Debug")!);
        Assert(config.allIncludes.some(path => path.path.toString() === "my\\test\\include\\path"));
        Assert(config.allIncludes.some(path => path.path.toString() === "my/other/include/path"));
        Assert(config.allDefines.some(define => define.identifier === "MY_SYMBOL" && define.value === "42"));
        Assert(config.allDefines.some(define => define.identifier === "MY_SYMBOL2" && define.value === "\"test\""));
    });

    test("Finds compiler configs", async() => {
        const config = await new DynamicConfigGenerator().generateConfiguration(workbench, project, armCompiler, project.findConfiguration("Debug")!);
        Assert(config.allIncludes.some(path => path.absolutePath.toString().match(/arm[/\\]inc[/\\]/)));
        Assert(config.allIncludes.some(path => path.absolutePath.toString().match(/arm[/\\]inc[/\\]c[/\\]aarch32/)));
        Assert(config.allDefines.some(define => define.identifier === "__thumb"));
        Assert(config.allDefines.some(define => define.identifier === "__VERSION__"));
    });


    test("Finds c++ configs", async() => {
        const config = await new DynamicConfigGenerator().generateConfiguration(workbench, project, armCompiler, project.findConfiguration("Debug")!);
        Assert(config.allIncludes.some(path => path.absolutePath.toString().endsWith("cpp")), "Does not include c++ header directory");
        // Assumes this define is always there, but might not be if using an old c++ standard?
        Assert(config.allDefines.some(define => define.identifier === "__cpp_constexpr"), "Does not include c++ defines");
    });

    test("Finds file specific configs", async() => {
        const config = await new DynamicConfigGenerator().generateConfiguration(workbench, project, armCompiler, project.findConfiguration("Debug")!);
        const projectFile = Path.join(projectDir, IntegrationTestsCommon.TEST_PROJECT_SOURCE_FILE);
        const includes = config.getIncludes(vscode.Uri.file(projectFile).fsPath);
        Assert.equal(includes!.map(path => path.path), ["only/this/file"]);
        const defines = config.getDefines(vscode.Uri.file(projectFile).fsPath);
        Assert.equal(defines!.map(def => def.identifier), ["FILE_SYMBOL"]);
    });
});