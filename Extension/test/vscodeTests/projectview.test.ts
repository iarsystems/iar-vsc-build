import * as Vscode from "vscode";
import * as Path from "path";
import * as Assert from "assert";
import { VscodeTestsUtils } from "./utils";
import { VscodeTestsSetup } from "./setup";
import { UI } from "../../src/extension/ui/app";
import { ProjectNode } from "../../src/extension/ui/treeprojectprovider";
import { OsUtils } from "../../utils/osUtils";

namespace Utils {
    export async function getNodes(parent?: ProjectNode) {
        const provider = UI.getInstance().projectTreeView._provider;
        const nodes = await provider.getChildren(parent);
        Assert(nodes);
        return nodes;
    }
    export function toTreeItems(nodes: ProjectNode[]) {
        const provider = UI.getInstance().projectTreeView._provider;
        return Promise.all(nodes.map(node => provider.getTreeItem(node)));
    }
}

suite("Test Project View", ()=>{
    let projectDir: string;
    let libSrcDir: string;

    suiteSetup(async function() {
        await VscodeTestsUtils.ensureExtensionIsActivated();
        const sandboxPath = VscodeTestsSetup.setup();
        projectDir = Path.join(sandboxPath, "SourceConfiguration/IAR-STM32F429II-EXP/LedFlasher");
        libSrcDir = Path.join(sandboxPath, "SourceConfiguration/STM32F4xx_DSP_StdPeriph_Lib/Libraries/STM32F4xx_StdPeriph_Driver/src");

        await VscodeTestsUtils.activateProject("LedFlasher");
    });

    test("Displays project files", async() => {
        const nodes = await Utils.getNodes();
        const items = await Utils.toTreeItems(nodes);
        const filesIndex = items.findIndex(item => item.label === "Files");
        const filesItem = items[filesIndex];
        Assert(filesItem);
        Assert.strictEqual(filesItem.contextValue, "filesroot");
        Assert.strictEqual(filesItem.collapsibleState, Vscode.TreeItemCollapsibleState.Expanded);

        const rootFileNodes = await Utils.getNodes(nodes[filesIndex]);
        Assert.strictEqual(rootFileNodes.length, 5);
        const rootFileItems = await Utils.toTreeItems(rootFileNodes);
        const mainItem = rootFileItems.find(item => item.label === "main.c");
        Assert(mainItem);
        Assert(mainItem.resourceUri);
        Assert(OsUtils.pathsEqual(mainItem.resourceUri.fsPath, Path.join(projectDir, "main.c")));
        Assert.strictEqual(mainItem.collapsibleState, Vscode.TreeItemCollapsibleState.None);

        const subgroupIndex = rootFileItems.findIndex(item => item.label === "STM32F4xx_StdPeriph_Driver");
        Assert.strictEqual(rootFileItems[subgroupIndex]?.contextValue, "group");
        Assert.strictEqual(rootFileItems[subgroupIndex]?.collapsibleState, Vscode.TreeItemCollapsibleState.Expanded);
        const subgroupNodes = await Utils.getNodes(rootFileNodes[subgroupIndex]);
        Assert.strictEqual(subgroupNodes.length, 6);
        const subgroupItems = await Utils.toTreeItems(subgroupNodes);
        const gpioItem = subgroupItems.find(item => item.label === "stm32f4xx_gpio.c");
        Assert(gpioItem);
        Assert(gpioItem.resourceUri);
        Assert(OsUtils.pathsEqual(gpioItem.resourceUri.fsPath, Path.join(libSrcDir, "stm32f4xx_gpio.c")));
        Assert.strictEqual(gpioItem.collapsibleState, Vscode.TreeItemCollapsibleState.None);
    });

    test("Displays project configurations", async() => {
        const nodes = await Utils.getNodes();
        const items = await Utils.toTreeItems(nodes);
        const configsIndex = items.findIndex(item => item.label === "Configurations");
        const configsItem = items[configsIndex];
        Assert(configsItem);
        Assert.strictEqual(configsItem.contextValue, "configsroot");
        Assert.strictEqual(configsItem.collapsibleState, Vscode.TreeItemCollapsibleState.Expanded);

        const configNodes = await Utils.getNodes(nodes[configsIndex]);
        Assert.strictEqual(configNodes.length, 1);
        const configItems = await Utils.toTreeItems(configNodes);
        const mainItem = configItems.find(item => item.label === "Flash Debug");
        Assert(mainItem);
        Assert(mainItem.description, "ARM");
        Assert.strictEqual(mainItem.collapsibleState, Vscode.TreeItemCollapsibleState.None);
    });
});