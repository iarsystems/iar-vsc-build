/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { fail } from "assert";
import * as assert from "assert";
import {ExtensionState} from "../../src/extension/extensionstate";
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ExtensionSettings } from "../../src/extension/settings/extensionsettings";
import { TestUtils } from "iar-vsc-common/testutils/testUtils";
import { TestSandbox } from "iar-vsc-common/testutils/testSandbox";
import { VscodeTestsUtils } from "./utils";
import { readdir, rm } from "fs/promises";
import { VscodeTestsSetup } from "./setup";
import { FsUtils } from "../../src/utils/fs";
import { OsUtils } from "iar-vsc-common/osUtils";
import { TestConfiguration } from "../testconfiguration";
import { BuildTaskDefinition, BuildTasks } from "../../src/extension/task/buildtasks";

namespace Utils {
    export const EXTENSION_ROOT = path.join(path.resolve(__dirname), "../../../");
    export const TEST_PROJECTS_ROOT = path.join(EXTENSION_ROOT, "tests/vscodeTests/TestProjects");

    // Tags for the tasks that can be executed
    export const BUILD = "Build Project";
    export const REBUILD = "Rebuild Project";
    export const CLEAN = "Clean Project";
    export const OPEN = "Open Workspace in IAR Embedded Workbench";

    export async function assertFileExists(path: string) {
        assert(await FsUtils.exists(path), `Expected ${path} to exist`);
    }
    export async function assertFileNotExists(path: string) {
        assert(!(await FsUtils.exists(path)), `Expected ${path} not to exist`);
    }

    export function setupProject(id: number, target: string, ewpFile: string, sandbox: TestSandbox) {
        // The unique output folder
        const outputFolder = sandbox.copyToSandbox(path.dirname(ewpFile), "Test_" + target + "_" + id);
        // The unique name of the ewp-file.
        const ewpId = `${path.basename(ewpFile, ".ewp")}_${target}_${id}.ewp`;

        // Generate the name of the outputfile
        const outputFile: string = path.join(outputFolder, ewpId);
        // Generate the ewp-file to work with.
        TestUtils.patchEwpFile(target, ewpFile, outputFile);

        // Remove the unpatched ewp from the sandbox
        fs.unlinkSync(path.join(outputFolder, path.basename(ewpFile)));

        return path.join(outputFolder, ewpId);
    }

    export function runTask(project: string, config: string, command: string) {
        const wb = ExtensionState.getInstance().workbenches.selected!;
        const definition: BuildTaskDefinition = {
            label: "Test Task",
            type: "iar",
            argumentVariablesFile: undefined,
            contexts: [],
            extraBuildArguments: [],
            builder: wb.builderPath,
            project,
            command,
            config,
        };
        const task = BuildTasks.generateFromDefinition(definition);
        assert(task);
        vscode.tasks.executeTask(task);
        return VscodeTestsUtils.waitForTask(ev => ev.execution.task.name === task.name);
    }
}



suite("Test build extension", ()=>{
    let sandbox: TestSandbox;
    let sandboxPath: string;

    suiteSetup(async() => {
        console.log("Test build extension");
        await VscodeTestsUtils.doExtensionSetup();
        sandboxPath = VscodeTestsSetup.setup();
        sandbox = VscodeTestsSetup.sandbox!;
        // Remove any build results from previous runs
        const nodes = await readdir(sandbox.path);
        await Promise.all(
            nodes.filter(node => node.match(/^Test_\w+_\d+/)).map(node => {
                return rm(path.join(sandbox.path, node), {recursive: true, force: true});
            })
        );
        await VscodeTestsUtils.activateWorkspace("TestProjects");
    });

    setup(function() {
        console.log("\n==========================================================" + this.currentTest!.title + "==========================================================\n");
    });

    test("No backups in project list", ()=>{
        const allProjects = ExtensionState.getInstance().getFallbackProjects();
        assert(!allProjects.some(project => path.basename(project).startsWith("Backup ")), "Backup files should not be included in the list of projects");
    });

    test("Load all configurations", async()=>{
        await VscodeTestsUtils.activateProject("BasicDebugging");
        const workspace = await ExtensionState.getInstance().workspace.getValue();
        assert(workspace?.projectConfigs.items.some(config => config.name === "Debug"));
        assert(workspace?.projectConfigs.items.some(config => config.name === "Release"));
    } );

    test("Check IAR tasks exist", async()=>{
        const taskToFind: string[] = [Utils.BUILD, Utils.REBUILD, Utils.CLEAN];
        if (OsUtils.detectOsType() === OsUtils.OsType.Windows) {
            taskToFind.push(Utils.OPEN);
        }
        // Needs to be awaited otherwise the fetchtasks does not return anything.
        await VscodeTestsUtils.activateProject("BasicDebugging");

        return vscode.tasks.fetchTasks({type : "iar"}).then((iarTasks)=>{
            const taskNames = iarTasks.map(task => task.name);
            assert.deepStrictEqual(taskNames.sort(), taskToFind.sort());
        }, (err)=>{
            fail(err);
        });
    });

    test("Build and clean project with all listed EW:s", async function() {
        this.timeout(70000);
        let ewpFile: string;
        if (TestConfiguration.getConfiguration().target === "riscv") {
            // See RISCV-3951 for more info
            ewpFile = path.join(path.join(Utils.EXTENSION_ROOT, "tests/vscodeTests/BasicProject_riscv", "BasicProject.ewp"));
        } else {
            ewpFile = path.join(path.join(Utils.EXTENSION_ROOT, "tests/vscodeTests/BasicProject", "BasicProject.ewp"));
        }
        let id = 1;
        // Generate a testproject to build using the generic template
        const testEwp = Utils.setupProject(id++, TestConfiguration.getConfiguration().target.toUpperCase(), ewpFile, sandbox);
        // Build the project.
        await Utils.runTask(testEwp, "Debug", "build");
        // Check that an output file has been created
        const exeFile = path.join(path.dirname(testEwp), "Debug", "Exe", path.basename(testEwp, ".ewp") + ".out");
        await Utils.assertFileExists(exeFile);
        // Check that warnings are parsed correctly
        // Doesn't seem like diagnostics are populated instantly after running tasks, so wait a bit
        await new Promise((p, _) => setTimeout(p, 2000));
        const srcFile = path.join(path.dirname(testEwp), "main.c");
        const diagnostics = vscode.languages.getDiagnostics(vscode.Uri.file(srcFile));
        assert.strictEqual(diagnostics[0]?.message,  "variable \"unused\" was declared but never referenced");
        assert.deepStrictEqual(diagnostics[0]?.range, new vscode.Range(new vscode.Position(2, 0), new vscode.Position(2, 0)));
        assert.strictEqual(diagnostics[0]?.severity, vscode.DiagnosticSeverity.Warning);

        // Clean the project.
        await Utils.runTask(testEwp, "Debug", "clean");
        await Utils.assertFileNotExists(exeFile);

        // Finally, check that no backup files were created (VSC-192)
        const backups = fs.readdirSync(path.dirname(testEwp)).filter(entry => entry.match(/Backup (\(\d+\) )?of /));
        assert.strictEqual(backups.length, 0, "The following backups were created: " + backups.join(", "));
    });

    test("Check that all EW's are listed", ()=>{
        // Get the list of configured workbenches.
        const configuredEws: string[] | undefined = vscode.workspace.getConfiguration("iar-build").get<string[]>(ExtensionSettings.ExtensionSettingsField.IarInstallDirectories);
        if (!configuredEws) {
            fail("No listed workbenches found");
        }

        // Get the list of selectable ew:s
        const listedEws = ExtensionState.getInstance().workbenches.items;
        // Check that the lists are the same.
        assert(configuredEws?.length <= listedEws.length);
        for (const configuredEw of configuredEws) {
            const ewId: string = path.basename(configuredEw.toString());
            assert(listedEws.some(ew => ew.name.startsWith(ewId)));
        }
    });

    test("Check that modifying projects affects extension state", async function() {
        this.timeout(40000);
        await VscodeTestsUtils.activateProject("BasicDebugging");

        // Change a configuration name and a file name, make sure the extension reacts
        const projectPath = path.join(sandboxPath, "GettingStarted/BasicDebugging.ewp");
        let ewpContents = fs.readFileSync(projectPath).toString();
        ewpContents = ewpContents.replace("<name>Release</name>", "<name>TheNewConfig</name>");
        ewpContents = ewpContents.replace("Fibonacci.c", "TheNewFile.c");
        fs.writeFileSync(projectPath, ewpContents);
        // Give vs code time to react
        await new Promise((p, _) => setTimeout(p, 3000));

        const workspace = await ExtensionState.getInstance().workspace.getValue();
        const project = workspace!.projects.selected;
        assert.strictEqual(project!.configurations.length, 2);
        assert(project!.findConfiguration("TheNewConfig") !== undefined);
        if (TestConfiguration.getConfiguration().testThriftSupport) {
            const extProject = await workspace!.asExtendedWorkspace()!.getExtendedProject(project!);
            assert((await extProject!.getRootNode())?.children.some(node => node.name === "TheNewFile.c"));
        }

    });

    test("Check that build task failures are communicated to VS Code", async()=>{
        // Regression test for VSC-302 (https://github.com/IARSystems/iar-vsc-build/issues/11)
        // The task should not run, because it depends on a build task that fails
        await VscodeTestsUtils.runTaskForProject("create temp file", "BasicDebugging", "Debug");
        assert.strictEqual(await FsUtils.exists(path.join(sandboxPath, "GettingStarted/BasicDebugging.ewp.tmp")), false, "Build task did not fail even though iarbuild failed");
    });
});