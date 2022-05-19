/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import * as Vscode from "vscode";
import * as Path from "path";
import * as Assert from "assert";
import { VscodeTestsUtils } from "./utils";
import { VscodeTestsSetup } from "./setup";
import { FilesNode } from "../../src/extension/ui/treeprojectprovider";
import { OsUtils } from "iar-vsc-common/osUtils";
import { IarVsc } from "../../src/extension/main";

namespace Utils {
    export async function getNodes(parent?: FilesNode) {
        const provider = IarVsc.projectTreeView._provider;
        const nodes = await provider.getChildren(parent);
        Assert(nodes);
        return nodes;
    }
    export function toTreeItems(nodes: FilesNode[]) {
        const provider = IarVsc.projectTreeView._provider;
        return Promise.all(nodes.map(node => provider.getTreeItem(node)));
    }
}

suite("Test Project View", ()=>{
    let projectDir: string;
    let libSrcDir: string;

    suiteSetup(async function() {
        this.timeout(50000);
        await VscodeTestsUtils.ensureExtensionIsActivated();
        const sandboxPath = VscodeTestsSetup.setup();
        projectDir = Path.join(sandboxPath, "SourceConfiguration/IAR-STM32F429II-EXP/LedFlasher");
        libSrcDir = Path.join(sandboxPath, "SourceConfiguration/STM32F4xx_DSP_StdPeriph_Lib/Libraries/STM32F4xx_StdPeriph_Driver/src");

        await VscodeTestsUtils.activateProject("LedFlasher");
    });

    test("Displays project files", async() => {
        const rootFileNodes = await Utils.getNodes();
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
});