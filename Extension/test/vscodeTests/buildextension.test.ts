
import { fail, deepEqual } from 'assert';
import {UI} from '../../src/extension/ui/app';
import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { Settings } from '../../src/extension/settings';
import {ProjectListModel} from '../../src/extension/model/selectproject'
import { TestUtils } from '../../utils/testutils/testUtils';
import { Project } from '../../src/iar/project/project';
import {IarUtils} from '../../utils/iarUtils'

export namespace Utils{
    export const TEST_PROJECT_ROOT:string = path.join(path.resolve(__dirname),'../../../test/vscodeTests/TestProjects');

    // Tags for working with the Iar GUI integration
    export const  EW:string = "EW Installation";
    export const  PROJECT:string = "Project";
    export const  CONFIG:string = "Configuration";

    // Tags for the tasks that can be executed
    export const  BUILD:string = "Iar Build";
    export const  REBUILD:string = "Iar Rebuild";

    export function failOnReject(reject:any){
        fail(reject);
    }

    export function getEntries(topNodeName : string){
        let theTree = UI.getInstance().settingsTreeView;
        let nodes = theTree.getChildren();
        if(Array.isArray(nodes)){
            for(let i = 0; i < nodes.length; i++){
                if(nodes[i].label === topNodeName)
                {
                    return theTree.getChildren(nodes[i]);
                }
            }
        }
        fail("Failed to locate: " + topNodeName);
    }

    export function assertNodelistContains(treeItems: vscode.ProviderResult<vscode.TreeItem[]>, labelToFind: string ){
        if(Array.isArray(treeItems)){
            for(let i = 0; i < treeItems.length; i++){
                if(treeItems[i].label?.toString().startsWith(labelToFind)){
                    return treeItems[i];
                }
            }
        }
        fail("Failed to locate item with label: " + labelToFind);
    }

    export function activateSomething(entryLabel:string, toActivate:string){
        let list = getEntries(entryLabel);
        let listEntry = assertNodelistContains(list,toActivate);

        if(!listEntry.command || !listEntry.command.arguments){
            fail();
        }
        return vscode.commands.executeCommand(listEntry.command.command, listEntry.command.arguments[0]);
    }

    export function activateProject(projectLabel: string){
        return activateSomething(PROJECT, projectLabel);
    }

    export function activateConfiguration(configurationTag: string){
        return activateSomething(CONFIG, configurationTag);
    }

    export function activateWorkbench(ew: string){
        return activateSomething(EW, ew);
    }

    /**
     * Execute a task and return a promise to keep track of the completion. The promise is resolved when
     * the matcher returns true.
     * @param task 
     * @param matcher 
     * @returns 
     */
     export async function executeTask(task: vscode.Task, matcher: (taskEvent: vscode.TaskEndEvent)=>boolean) {
		await vscode.tasks.executeTask(task);

		return new Promise<void>(resolve => {
			let disposable = vscode.tasks.onDidEndTask(e => {
				if (matcher(e)) {
					disposable.dispose();
					resolve();
				}
			});
        });
	}

    export function assertFileExists(path:string){
		return fs.stat(path, (exists) => {
			if (exists == null) {
				return;
			} else if (exists.code === 'ENOENT') {6
				fail(`${path} is missing`)
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
     export async function runTaskForProject(taskName:string, projectName:string, configuration:string){
        // To have the call to vscode.tasks working the activate calls needs to be awaited.
        await activateProject(projectName);
        await activateConfiguration(configuration);

        // Fetch the tasks and execute the build task.
        return vscode.tasks.fetchTasks().then(async (listedTasks)=>{
            // Locate the build task
            let theTask = listedTasks.find((task)=>{return task.name === taskName;})
            if(!theTask){
                fail("Failed to locate " + taskName);
            }

            // Execute the task and wait for it to complete
			await Utils.executeTask(theTask, (e)=>{
				return e.execution.task.name === taskName;
			});
		},(reason)=>{
            fail(reason);
        });
    }

    export async function createProject(projName:string){
        const exWorkbench = await UI.getInstance().extendedWorkbench.selectedPromise;
        if (!exWorkbench) {
            fail("Failed to get the active workbench");
        }

        // Locate the Test folder in the workspace.
        const workspaces = vscode.workspace.workspaceFolders;
        if(!workspaces){
            fail("Failed to list the folders in the workspace: This test requires a workspace");
        }

        const newProj = path.join(workspaces[0].uri.fsPath, projName);
        const proj = await exWorkbench.createProject(newProj);

        (UI.getInstance().project.model as ProjectListModel).addProject(proj);
        return newProj;
    }

    export function setupProject(id:number, target:string, ewpFile:string) : any {
        // The unique name of the ewp-file.
        let ewpId:string = `${path.basename(ewpFile, '.ewp')}_${target}_${id}.ewp`
        // The unique output folder
        let outputFolder:string = path.join(Utils.TEST_PROJECT_ROOT, "Test_" + target + "_" + id);

        // Delete if already existing.
        if(fs.existsSync(outputFolder)){
            TestUtils.deleteDirectory(outputFolder);
        }
        fs.mkdirSync(outputFolder);

        // Generate the name of the outputfile
        let outputFile: string = path.join(outputFolder, ewpId);
        // Generate the ewp-file to work with.
        TestUtils.patchEwpFile(target,ewpFile, outputFile);
        // Add the ewp-file to the list of project.
        (UI.getInstance().project.model as ProjectListModel).addProject(new Project(outputFile));
        
        return {ewp: ewpId, folder: outputFolder}
    }
}



suite("Test build extension", ()=>{
    
    test("Load projects in directory",()=>{
        let allProjects = Utils.getEntries(Utils.PROJECT);
        Utils.assertNodelistContains(allProjects,"BasicProject");
        Utils.assertNodelistContains(allProjects,"BasicDebugging");
    });

    test("No backups in project list", ()=>{
        let allProjects = Utils.getEntries(Utils.PROJECT);
        if(Array.isArray(allProjects)){
            for(let i = 0; i < allProjects.length; i++){
                if(allProjects[i].label?.toString().startsWith("Backup ")){
                    fail("Backup files should not be included in the list of projects")
                }
            }
        }
    })

    test("Load all configurations",()=>{
        Utils.activateProject("BasicDebugging").then(()=>{
            let allConfigurations = Utils.getEntries(Utils.CONFIG);
            Utils.assertNodelistContains(allConfigurations,"Debug");
            Utils.assertNodelistContains(allConfigurations,"Release");
        })
    } )

    test("Check IAR tasks exist", async ()=>{
        const taskToFind:string[] = [Utils.BUILD, Utils.REBUILD];
        // Needs to be awaited otherwise the fetchtasks does not return anything.
        await Utils.activateProject("BasicDebugging");
        
        return vscode.tasks.fetchTasks({type : "iar"}).then((iar_tasks)=>{
                deepEqual(iar_tasks.length,taskToFind.length,"To few iar tasks located.");
                iar_tasks.forEach((task)=>{
                    deepEqual(taskToFind.includes(task.name),true);
                })
            }, (err)=>{
                fail(err);
            });
    });

    test("Build project with all listed EW:s", async ()=>{
        let ewpFile = path.join(path.join(Utils.TEST_PROJECT_ROOT, "BasicProject", "BasicProject.ewp"));
        let listedEws = Utils.getEntries(Utils.EW);
        let id:number = 1;
        if(Array.isArray(listedEws)){
            for(let ew of listedEws){
                if(ew.label && ew.tooltip){
                    // The tooltip is the absolute path to the current workbench. Read all the targets from the workbench.
                    let targets:string[] = IarUtils.getTargetsFromEwPath(ew.tooltip.toString())
                    for(let target of targets){
                        // Generate a testproject to build using the generic template
                        let testEwp = Utils.setupProject(id++, target.toUpperCase(), ewpFile);
                        // Build the project.
                        await Utils.runTaskForProject(Utils.BUILD, path.basename(testEwp.ewp, ".ewp"), "Debug");
                        // Check that an output file has been created
                        await Utils.assertFileExists(path.join(testEwp.folder, "Debug", "Exe", path.basename(testEwp.ewp, ".ewp") + ".out"));
                    }
                }else{
                    console.log("Skipping " + ew);
                    continue;
                }
            }
        }
    });

    test("Check that all EW's are listed", ()=>{
        // Get the list of configured workbenches.
        let configuredEws: String[] | undefined = vscode.workspace.getConfiguration("iarvsc").get<String[]>(Settings.Field.IarInstallDirectories);
        if(!configuredEws){
            fail("No listed workbenches found");
        }

        // Get the list of selectable ew:s
        let listedEws = Utils.getEntries(Utils.EW);
        if(Array.isArray(listedEws)){
            // Check that the lists are the same.
            deepEqual(configuredEws?.length, listedEws.length);
            for(let configuredEw of configuredEws){
                let ewId:string = path.basename(configuredEw.toString());
                Utils.assertNodelistContains(listedEws, ewId);
            }
        }else{
            fail("Failed to collect configurable workbenches.");
        }
    });

});