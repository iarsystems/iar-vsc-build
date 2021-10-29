
import { fail, deepEqual } from "assert";
import {UI} from "../../src/extension/ui/app";
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Settings } from "../../src/extension/settings";
import {ProjectListModel} from "../../src/extension/model/selectproject";
import { TestUtils } from "../../utils/testutils/testUtils";
import { Project } from "../../src/iar/project/project";
import {IarUtils} from "../../utils/iarUtils";
import { TestSandbox } from "../../utils/testutils/testSandbox";
import { VscodeTestsSetup } from "./setup";

export namespace Utils{
    export const EXTENSION_ROOT = path.join(path.resolve(__dirname), "../../../");
    export const TEST_PROJECTS_ROOT = path.join(EXTENSION_ROOT, "test/vscodeTests/TestProjects");

    // Tags for working with the Iar GUI integration
    export const  EW = "EW Installation";
    export const  PROJECT = "Project";
    export const  CONFIG = "Configuration";

    // Tags for the tasks that can be executed
    export const  BUILD = "Iar Build";
    export const  REBUILD = "Iar Rebuild";

    export function failOnReject(reject: any) {
        fail(reject);
    }

    export function getEntries(topNodeName: string) {
        const theTree = UI.getInstance().settingsTreeView;
        const nodes = theTree.getChildren();
        if (Array.isArray(nodes)) {
            for (let i = 0; i < nodes.length; i++) {
                if (nodes[i].label === topNodeName) {
                    return theTree.getChildren(nodes[i]);
                }
            }
        }
        fail("Failed to locate: " + topNodeName);
    }

    export function assertNodelistContains(treeItems: vscode.ProviderResult<vscode.TreeItem[]>, labelToFind: string ) {
        if (Array.isArray(treeItems)) {
            for (let i = 0; i < treeItems.length; i++) {
                if (treeItems[i].label?.toString().startsWith(labelToFind)) {
                    return treeItems[i];
                }
            }
        }
        fail("Failed to locate item with label: " + labelToFind);
    }

    export function activateSomething(entryLabel: string, toActivate: string) {
        const list = getEntries(entryLabel);
        const listEntry = assertNodelistContains(list, toActivate);

        if (!listEntry.command || !listEntry.command.arguments) {
            fail();
        }
        return vscode.commands.executeCommand(listEntry.command.command, listEntry.command.arguments[0]);
    }

    export function activateProject(projectLabel: string) {
        return activateSomething(PROJECT, projectLabel);
    }

    export function activateConfiguration(configurationTag: string) {
        return activateSomething(CONFIG, configurationTag);
    }

    export function activateWorkbench(ew: string) {
        return activateSomething(EW, ew);
    }

    /**
     * Execute a task and return a promise to keep track of the completion. The promise is resolved when
     * the matcher returns true.
     * @param task
     * @param matcher
     * @returns
     */
     export async function executeTask(task: vscode.Task, matcher: (taskEvent: vscode.TaskEndEvent) => boolean) {
         await vscode.tasks.executeTask(task);

         return new Promise<void>(resolve => {
             const disposable = vscode.tasks.onDidEndTask(e => {
                 if (matcher(e)) {
                     disposable.dispose();
                     resolve();
                 }
             });
         });
     }

    export function assertFileExists(path: string) {
        return fs.stat(path, (exists) => {
            if (exists === null) {
                return;
            } else if (exists.code === "ENOENT") {
                6;
                fail(`${path} is missing`);
            }
        });
    }

    /**
     * Run a task with the given name for the a project and configuration. Returns a promise that resolves
     * once the task has been executed.
     * @param taskName
     * @param projectName
     * @param configuration
     * @returns
     */
     export async function runTaskForProject(taskName: string, projectName: string, configuration: string) {
         // To have the call to vscode.tasks working the activate calls needs to be awaited.
         await activateProject(projectName);
         await activateConfiguration(configuration);

         // Fetch the tasks and execute the build task.
         return vscode.tasks.fetchTasks().then(async(listedTasks)=>{
             // Locate the build task
             const theTask = listedTasks.find((task)=>{
                 return task.name === taskName;
             });
             if (!theTask) {
                 fail("Failed to locate " + taskName);
             }

             // Execute the task and wait for it to complete
             await Utils.executeTask(theTask, (e)=>{
                 return e.execution.task.name === taskName;
             });
         }, (reason)=>{
             fail(reason);
         });
     }

    export async function createProject(projName: string) {
        const exWorkbench = await UI.getInstance().extendedWorkbench.selectedPromise;
        if (!exWorkbench) {
            fail("Failed to get the active workbench");
        }

        // Locate the Test folder in the workspace.
        const workspaces = vscode.workspace.workspaceFolders;
        if (!workspaces) {
            fail("Failed to list the folders in the workspace: This test requires a workspace");
        }

        const newProj = path.join(workspaces[0].uri.fsPath, projName);
        const proj = await exWorkbench.createProject(newProj);

        (UI.getInstance().project.model as ProjectListModel).addProject(proj);
        return newProj;
    }

    export function setupProject(id: number, target: string, ewpFile: string, sandbox: TestSandbox): any {
        // The unique output folder
        const outputFolder = sandbox.copyToSandbox(path.dirname(ewpFile), "Test_" + target + "_" + id);
        // The unique name of the ewp-file.
        const ewpId = `${path.basename(ewpFile, ".ewp")}_${target}_${id}.ewp`;

        // Generate the name of the outputfile
        const outputFile: string = path.join(outputFolder, ewpId);
        // Generate the ewp-file to work with.
        TestUtils.patchEwpFile(target, ewpFile, outputFile);
        // Add the ewp-file to the list of project.
        (UI.getInstance().project.model as ProjectListModel).addProject(new Project(outputFile));

        // Remove the unpatched ewp from the sandbox
        fs.unlinkSync(path.join(outputFolder, path.basename(ewpFile)));

        return {ewp: ewpId, folder: outputFolder};
    }
}



suite("Test build extension", ()=>{

    let sandbox: TestSandbox;

    suiteSetup(() => {
        if (VscodeTestsSetup.sandbox === undefined) {
            VscodeTestsSetup.setup();
        }
        sandbox = VscodeTestsSetup.sandbox!;
    });

    test("Load projects in directory", ()=>{
        const allProjects = Utils.getEntries(Utils.PROJECT);
        Utils.assertNodelistContains(allProjects, "BasicProject");
        Utils.assertNodelistContains(allProjects, "BasicDebugging");
    });

    test("No backups in project list", ()=>{
        const allProjects = Utils.getEntries(Utils.PROJECT);
        if (Array.isArray(allProjects)) {
            for (let i = 0; i < allProjects.length; i++) {
                if (allProjects[i].label?.toString().startsWith("Backup ")) {
                    fail("Backup files should not be included in the list of projects");
                }
            }
        }
    });

    test("Load all configurations", async()=>{
        await Utils.activateProject("BasicDebugging").then(()=>{
            const allConfigurations = Utils.getEntries(Utils.CONFIG);
            Utils.assertNodelistContains(allConfigurations, "Debug");
            Utils.assertNodelistContains(allConfigurations, "Release");
        });
    } );

    test("Check IAR tasks exist", async()=>{
        const taskToFind: string[] = [Utils.BUILD, Utils.REBUILD];
        // Needs to be awaited otherwise the fetchtasks does not return anything.
        await Utils.activateProject("BasicDebugging");

        return vscode.tasks.fetchTasks({type : "iar"}).then((iarTasks)=>{
            deepEqual(iarTasks.length, taskToFind.length, "To few iar tasks located.");
            iarTasks.forEach((task)=>{
                deepEqual(taskToFind.includes(task.name), true);
            });
        }, (err)=>{
            fail(err);
        });
    });

    test("Build project with all listed EW:s", async()=>{
        const ewpFile = path.join(path.join(Utils.TEST_PROJECTS_ROOT, "BasicProject", "BasicProject.ewp"));
        const listedEws = Utils.getEntries(Utils.EW);
        let id = 1;
        if (Array.isArray(listedEws)) {
            for (const ew of listedEws) {
                if (ew.label && ew.tooltip) {
                    // The tooltip is the absolute path to the current workbench. Read all the targets from the workbench.
                    const targets: string[] = IarUtils.getTargetsFromEwPath(ew.tooltip.toString());
                    for (const target of targets) {
                        // Generate a testproject to build using the generic template
                        const testEwp = Utils.setupProject(id++, target.toUpperCase(), ewpFile, sandbox);
                        // Build the project.
                        await Utils.runTaskForProject(Utils.BUILD, path.basename(testEwp.ewp, ".ewp"), "Debug");
                        // Check that an output file has been created
                        await Utils.assertFileExists(path.join(testEwp.folder, "Debug", "Exe", path.basename(testEwp.ewp, ".ewp") + ".out"));
                    }
                } else {
                    console.log("Skipping " + ew);
                    continue;
                }
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
        const listedEws = Utils.getEntries(Utils.EW);
        if (Array.isArray(listedEws)) {
            // Check that the lists are the same.
            deepEqual(configuredEws?.length, listedEws.length);
            for (const configuredEw of configuredEws) {
                const ewId: string = path.basename(configuredEw.toString());
                Utils.assertNodelistContains(listedEws, ewId);
            }
        } else {
            fail("Failed to collect configurable workbenches.");
        }
    });

});