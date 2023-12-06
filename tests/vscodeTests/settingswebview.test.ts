/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import * as Assert from "assert";
import * as Vscode from "vscode";
import { VscodeTestsUtils } from "./utils";
import { VscodeTestsSetup } from "./setup";
import { IarVsc } from "../../src/extension/main";
import { ExtensionState } from "../../src/extension/extensionstate";
import { DropdownIds } from "../../src/extension/ui/settingswebview";
import { ListInputModel } from "../../src/extension/model/model";
import { WorkbenchType } from "iar-vsc-common/workbench";


/**
 * Tests the interactivity of the settings view, i.e. that we can select dropdown options
 * and that that is propagated to the data models.
 */
suite("Test Clicking Settings View", ()=>{
    suiteSetup(async function() {
        // VS Code can take a really long time to load our view sometimes, hence the long timeout.
        this.timeout(80000);
        await VscodeTestsUtils.doExtensionSetup();
        VscodeTestsSetup.setup();
        await VscodeTestsUtils.activateWorkspace("TestProjects");

        // Focus the view. Otherwise it will not be instantiated/resolved.
        await Vscode.commands.executeCommand("iar-configuration.focus");
        await new Promise((res, _) => setTimeout(res, 1000));
        await IarVsc.settingsView.awaitViewLoaded();
    });

    setup(function() {
        console.log("\n==========================================================" + this.currentTest!.title + "==========================================================\n");
    });

    suite("Clicking workbench updates model", () => {
        let addedMockWorkbench = false;

        test("Clicking workbench updates model", async() => {
            const workbenchModel = ExtensionState.getInstance().workbenches;

            // We need at least two workbenches for this, so add a fake one if there is only one workbench
            if (workbenchModel.items.length === 1) {
                addedMockWorkbench = true;
                workbenchModel.set(...workbenchModel.items, {
                    name: "MockWorkbench",
                    builderPath: "MockWorkbench",
                    idePath: "MockWorkbench",
                    path: workbenchModel.items[0]?.path?? "MockWorkbench",
                    targetIds: [],
                    type: WorkbenchType.IDE,
                    version: { major: 0, minor: 0, patch: 0 }
                });
                // Wait for the view to redraw
                await new Promise((res, _) => setTimeout(res, 1000));
            }

            let indexToSelect = -1;
            for (let i = 0; i < workbenchModel.items.length; i++) {
                if (i !== workbenchModel.selectedIndex) {
                    indexToSelect = i;
                    break;
                }
            }
            const modelChange = waitForModelChange(ExtensionState.getInstance().workbenches);
            IarVsc.settingsView.selectFromDropdown(DropdownIds.Workbench, indexToSelect);
            await modelChange;

            Assert.strictEqual(ExtensionState.getInstance().workbenches.selectedIndex, indexToSelect);
        });
        suiteTeardown(() => {
            if (addedMockWorkbench) {
                const workbenchModel = ExtensionState.getInstance().workbenches;
                workbenchModel.set(...workbenchModel.items.filter(wb => wb.name !== "MockWorkbench"));
            }
        });
    });

    test("Clicking workspace updates model", async() => {
        Assert(ExtensionState.getInstance().workspaces.selectedIndex !== 1);
        const modelChange = waitForModelChange(ExtensionState.getInstance().workspaces);
        IarVsc.settingsView.selectFromDropdown(DropdownIds.Workspace, 1);
        await modelChange;

        Assert.strictEqual(ExtensionState.getInstance().workspaces.selectedIndex, 1);

        // Restore workspace since other tests depend on it
        await VscodeTestsUtils.activateWorkspace("TestProjects");
    });


    test("Clicking project updates model", async() => {
        await VscodeTestsUtils.activateProject("BasicDebugging");
        const workspace = await ExtensionState.getInstance().workspace.getValue();
        // Let the view settle
        await new Promise((res, _) => setTimeout(res, 1000));

        Assert(workspace!.projects.selectedIndex !== 2, workspace!.projects.selected!.name);
        const modelChange = waitForModelChange(workspace!.projects);
        IarVsc.settingsView.selectFromDropdown(DropdownIds.Project, 2);
        await modelChange;

        Assert.strictEqual(workspace!.projects.selectedIndex, 2);
    });
    test("Clicking config updates model", async() => {
        await VscodeTestsUtils.activateProject("BasicDebugging");
        const workspace = await ExtensionState.getInstance().workspace.getValue();
        // Let the view settle
        await new Promise((res, _) => setTimeout(res, 1000));

        Assert(workspace!.projectConfigs.selectedIndex !== 1);
        const modelChange = waitForModelChange(workspace!.projectConfigs);
        IarVsc.settingsView.selectFromDropdown(DropdownIds.Configuration, 1);
        await modelChange;

        Assert.strictEqual(workspace!.projectConfigs.selectedIndex, 1);
    });

    const waitForModelChange = function<T>(model: ListInputModel<T>) {
        return new Promise<void>((res, rej) => {
            let hasIgnored = false;
            model.addOnSelectedHandler(() => {
                // The first callback is made immediately, so ignored it
                if (!hasIgnored) {
                    hasIgnored = true;
                } else {
                    res();
                }
            });
            setTimeout(() => {
                rej(new Error("Timed out"));
            }, 10000);
        });
    };
});
