
import { fail } from "assert";
import * as assert from "assert";
import {ExtensionState} from "../../src/extension/extensionstate";
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Settings } from "../../src/extension/settings";
import { TestUtils } from "../../utils/testutils/testUtils";
import { Project } from "../../src/iar/project/project";
import {IarUtils} from "../../utils/iarUtils";
import { TestSandbox } from "../../utils/testutils/testSandbox";
import { VscodeTestsUtils } from "./utils";
import { readdir, rm } from "fs/promises";
import { VscodeTestsSetup } from "./setup";
import { FsUtils } from "../../src/utils/fs";
import { OsUtils } from "../../utils/osUtils";

export namespace Utils{
    export const EXTENSION_ROOT = path.join(path.resolve(__dirname), "../../../");
    export const TEST_PROJECTS_ROOT = path.join(EXTENSION_ROOT, "test/vscodeTests/TestProjects");

    // Tags for the tasks that can be executed
    export const  BUILD = "Iar Build";
    export const  REBUILD = "Iar Rebuild";
    export const  CLEAN = "Iar Clean";
    export const  OPEN = "Iar Open";

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
        // Add the ewp-file to the list of project.
        ExtensionState.getInstance().project.addProject(new Project(outputFile));

        // Remove the unpatched ewp from the sandbox
        fs.unlinkSync(path.join(outputFolder, path.basename(ewpFile)));

        return {ewp: ewpId, folder: outputFolder};
    }
}



suite("Test build extension", ()=>{

    let sandbox: TestSandbox;

    suiteSetup(async() => {
        await VscodeTestsUtils.ensureExtensionIsActivated();
        VscodeTestsSetup.setup();
        sandbox = VscodeTestsSetup.sandbox!;
        // Remove any build results from previous runs
        const nodes = await readdir(sandbox.path);
        return Promise.all(
            nodes.filter(node => node.match(/^Test_\w+_\d+/)).map(node => {
                return rm(path.join(sandbox.path, node), {recursive: true, force: true});
            })
        );
    });

    test("Load projects in directory", ()=>{
        const allProjects = ExtensionState.getInstance().project.projects;
        assert(allProjects.some(config => config.name === "BasicDebugging"));
        assert(allProjects.some(config => config.name === "C-STATProject"));
        assert(allProjects.some(config => config.name === "LedFlasher"));
    });

    test("No backups in project list", ()=>{
        const allProjects = ExtensionState.getInstance().project.projects;
        assert(!allProjects.some(project => project.name?.toString().startsWith("Backup ")), "Backup files should not be included in the list of projects");
    });

    test("Load all configurations", async()=>{
        await VscodeTestsUtils.activateProject("BasicDebugging").then(()=>{
            assert(ExtensionState.getInstance().config.configurations.some(config => config.name === "Debug"));
            assert(ExtensionState.getInstance().config.configurations.some(config => config.name === "Release"));
        });
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
        this.timeout(50000);
        const ewpFile = path.join(path.join(Utils.EXTENSION_ROOT, "test/vscodeTests/BasicProject", "BasicProject.ewp"));
        const listedEws = ExtensionState.getInstance().workbench.workbenches;
        let id = 1;
        for (const ew of listedEws) {
            VscodeTestsUtils.activateWorkbench(ew.name);
            // The tooltip is the absolute path to the current workbench. Read all the targets from the workbench.
            const targets: string[] = IarUtils.getTargetsFromEwPath(ew.path.toString());
            for (const target of targets) {
                // Generate a testproject to build using the generic template
                const testEwp = Utils.setupProject(id++, target.toUpperCase(), ewpFile, sandbox);
                // Build the project.
                await VscodeTestsUtils.runTaskForProject(Utils.BUILD, path.basename(testEwp.ewp, ".ewp"), "Debug");
                // Check that an output file has been created
                const exeFile = path.join(testEwp.folder, "Debug", "Exe", path.basename(testEwp.ewp, ".ewp") + ".out");
                await Utils.assertFileExists(exeFile);
                // Check that warnings are parsed correctly
                // Doesn't seem like diagnostics are populated instantly after running tasks, so wait a bit
                await new Promise((p, _) => setTimeout(p, 2000));
                const srcFile = path.join(testEwp.folder, "main.c");
                const diagnostics = vscode.languages.getDiagnostics(vscode.Uri.file(srcFile));
                assert.strictEqual(diagnostics[0]?.message,  "variable \"unused\" was declared but never referenced");
                assert.deepStrictEqual(diagnostics[0]?.range, new vscode.Range(new vscode.Position(2, 0), new vscode.Position(2, 0)));
                assert.strictEqual(diagnostics[0]?.severity, vscode.DiagnosticSeverity.Warning);

                // Clean the project.
                await VscodeTestsUtils.runTaskForProject(Utils.CLEAN, path.basename(testEwp.ewp, ".ewp"), "Debug");
                await Utils.assertFileNotExists(exeFile);
            }
        }
    });

    test("Check that all EW's are listed", ()=>{
        // Get the list of configured workbenches.
        const configuredEws: string[] | undefined = vscode.workspace.getConfiguration("iarvsc").get<string[]>(Settings.ExtensionSettingsField.IarInstallDirectories);
        if (!configuredEws) {
            fail("No listed workbenches found");
        }

        // Get the list of selectable ew:s
        const listedEws = ExtensionState.getInstance().workbench.workbenches;
        // Check that the lists are the same.
        assert.deepStrictEqual(configuredEws?.length, listedEws.length);
        for (const configuredEw of configuredEws) {
            const ewId: string = path.basename(configuredEw.toString());
            assert(listedEws.some(ew => ew.name === ewId));
        }
    });

});