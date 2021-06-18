
import { fail, deepEqual } from 'assert';
import {UI} from '../../src/extension/ui/app';
import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'

// @ts-ignore
class Utils{
    public static TEST_PROJECT_ROOT:string = path.join(path.resolve(__dirname), "TestProjects");

    // Tags for working with the Iar GUI integration
    public static EW:string = "EW Installation";
    public static PROJECT:string = "Project";
    public static CONFIG:string = "Configuration";

    // Tags for the tasks that can be executed
    public static BUILD:string = "Iar Build";
    public static REBUILD:string = "Iar Rebuild";

    public static getEntries(topNodeName : string){
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

    public static assertNodelistContains(treeItems: vscode.ProviderResult<vscode.TreeItem[]>, labelToFind: string ){
        if(Array.isArray(treeItems)){
            for(let i = 0; i < treeItems.length; i++){
                if(treeItems[i].label?.toString().startsWith(labelToFind)){
                    return treeItems[i];
                }
            }
        }
        fail("Failed to locate item with label: " + labelToFind);
    }

    private static activateSomething(entryLabel:string, toActivate:string){
        let list = this.getEntries(entryLabel);
        let listEntry = this.assertNodelistContains(list,toActivate);

        if(!listEntry.command || !listEntry.command.arguments){
            fail();
        }
        return vscode.commands.executeCommand(listEntry.command.command, listEntry.command.arguments[0]);
    }

    public static activateProject(projectLabel: string){
        return this.activateSomething(this.PROJECT, projectLabel);
    }

    public static activateConfiguration(configurationTag: string){
        return this.activateSomething(this.CONFIG, configurationTag);
    }

    public static activateWorkbench(ew: string){
        return this.activateSomething(this.EW, ew);
    }

    /**
     * Execute a task and return a promise to keep track of the completion. The promise is resolved when
     * the matcher returns true.
     * @param task 
     * @param matcher 
     * @returns 
     */
    static async executeTask(task: vscode.Task, matcher: (taskEvent: vscode.TaskEndEvent)=>boolean) {
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

    static assertFileExists(path:string){
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
    public static async runTaskForProject(taskName:string, projectName:string, configuration:string){
        // To have the call to vscode.tasks working the activate calls needs to be awaited.
        await this.activateProject(projectName);
        await this.activateConfiguration(configuration);

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

    test("Build project", ()=>{
        return Utils.runTaskForProject(Utils.BUILD, "BasicDebugging", "Debug").then(()=>{
          Utils.assertFileExists(path.join(Utils.TEST_PROJECT_ROOT, "GettingStarted", "Debug", "BasicDebugging.out"))
        });
    });

});