
import { fail } from 'assert';
import {UI} from '../../src/extension/ui/app';
import * as VsCode from 'vscode'

class Utils{
    public static EW:string = "EW Installation";
    public static PROJECT:string = "Project";
    public static CONFIG:string = "Configuration";

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

    public static assertNodelistContains(treeItems: VsCode.ProviderResult<VsCode.TreeItem[]>, labelToFind: string ){
        if(Array.isArray(treeItems)){
            for(let i = 0; i < treeItems.length; i++){
                if(treeItems[i].label?.toString().startsWith(labelToFind)){
                    return treeItems[i];
                }
            }
        }
        fail("Failed to locate item with label: " + labelToFind);
    }

    public static activateProject(projectLabel: string){
        let projects = this.getEntries(this.PROJECT);
        let myProject = this.assertNodelistContains(projects,projectLabel);

        if(!myProject.command || !myProject.command.arguments){
            fail();
        }
        return VsCode.commands.executeCommand(myProject.command.command, myProject.command.arguments[0]).then(()=>{
            console.log("");
        });
    }
}

suite("Test build extension", ()=>{
    test("Load projects in directory",()=>{
        let allProjects = Utils.getEntries(Utils.PROJECT);
        Utils.assertNodelistContains(allProjects,"BasicProject");
        Utils.assertNodelistContains(allProjects,"BasicDebugging");
    });

    test("Load all configurations",()=>{
        Utils.activateProject("BasicDebugging").then(()=>{
            let allConfigurations = Utils.getEntries(Utils.CONFIG);
            Utils.assertNodelistContains(allConfigurations,"Debug");
            Utils.assertNodelistContains(allConfigurations,"Release");
        })
    } )
});