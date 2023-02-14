/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Assert from "assert";
import { EwpFile } from "../../src/iar/project/parsing/ewpfile";
import { Workbench } from "iar-vsc-common/workbench";
import { IntegrationTestsCommon } from "./common";
import { TestSandbox } from "iar-vsc-common/testutils/testSandbox";
import * as Path from "path";
import { OsUtils } from "iar-vsc-common/osUtils";
import { WorkspaceIntellisenseProvider } from "../../src/extension/intellisense/workspaceintellisenseprovider";
import { TestConfiguration } from "../testconfiguration";

suite("Test source configuration providers", function() {
    this.timeout(0);

    let workbench: Workbench;
    let sandbox: TestSandbox;
    let projectDir: string;
    let project: EwpFile;

    suiteSetup(async() => {
        const workbenches = await IntegrationTestsCommon.findWorkbenchesContainingTarget(TestConfiguration.getConfiguration().target);
        Assert(workbenches && workbenches.length > 0, "Found no suitable workbench to test with");
        workbench = workbenches[0]!;

        sandbox = new TestSandbox(IntegrationTestsCommon.PROJECT_ROOT);
        projectDir = sandbox.copyToSandbox(TestConfiguration.getConfiguration().integrationTestProjectsDir, "SourceConfigTests");
        project = new EwpFile(Path.join(projectDir, IntegrationTestsCommon.TEST_PROJECT_NAME));
        Assert(project.findConfiguration("Debug"), "Test project should have a Debug configuration");
    });

    test("Finds project-wide configs", async() => {
        // This file has no overriden settings, so it should use the project-defined include paths etc.
        const projectFile = Path.join(projectDir, "util.c");
        const intellisenseProv = await WorkspaceIntellisenseProvider.loadProjects([project], workbench, "Debug");
        const intellisenseInfo = await intellisenseProv.getIntellisenseInfoFor(projectFile);
        Assert(intellisenseInfo.includes.some(path => OsUtils.pathsEqual(path.path.toString(), Path.join(projectDir, "inc"))), `Includes were: ${intellisenseInfo.includes.map(i => i.absolutePath.toString())}`);
        Assert(intellisenseInfo.defines.some(define => define.identifier === "MY_SYMBOL" && define.value === "42"));
        Assert(intellisenseInfo.defines.some(define => define.identifier === "MY_SYMBOL2" && define.value === "\"test\""));
        Assert(intellisenseInfo.preincludes.some(inc => inc.path === "preincluded.h"));
    });

    test("Finds compiler configs", async() => {
        // Any file would work here
        const projectFile = Path.join(projectDir, IntegrationTestsCommon.TEST_PROJECT_SOURCE_FILE);
        const intellisenseProv = await WorkspaceIntellisenseProvider.loadProjects([project], workbench, "Debug");
        // Load a file so there is a valid browse config
        await intellisenseProv.getIntellisenseInfoFor(projectFile);
        const config = intellisenseProv.getBrowseInfo();
        for (const regex of TestConfiguration.getConfiguration().defaultIncludePaths) {
            Assert(config.includes.some(path => path.absolutePath.toString().match(regex)));
        }
        Assert(config.defines.some(define => define.identifier === TestConfiguration.getConfiguration().architectureDefine));
        Assert(config.defines.some(define => define.identifier === "__VERSION__"));
    });

    test("Finds c++ configs", async() => {
        // This file uses c++ settings
        const projectFile = Path.join(projectDir, "cpp.cpp");
        const intellisenseProv = await WorkspaceIntellisenseProvider.loadProjects([project], workbench, "Debug");
        // Load a file so there is a valid browse config
        await intellisenseProv.getIntellisenseInfoFor(projectFile);
        const config = intellisenseProv.getBrowseInfo();
        Assert(config.includes.some(path => path.absolutePath.toString().endsWith("cpp")), `Does not include c++ header directory. Includes were: ${config.includes.map(i => i.absolutePath.toString())}`);
        // Assumes this define is always there, but might not be if using an old c++ standard?
        Assert(config.defines.some(define => define.identifier === "__cpp_constexpr"), "Does not include c++ defines");
    });

    test("Finds file specific configs", async() => {
        // This file has overriden include paths and defines
        const projectFile = Path.join(projectDir, IntegrationTestsCommon.TEST_PROJECT_SOURCE_FILE);
        const config = await (await WorkspaceIntellisenseProvider.loadProjects([project], workbench, "Debug")).getIntellisenseInfoFor(projectFile);
        Assert(config.includes!.some(path => OsUtils.pathsEqual(path.path.toString(), Path.join(projectDir, "inc2"))));
        Assert(config.defines!.some(define => define.identifier === "FILE_SYMBOL"));
    });
});
