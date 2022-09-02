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
        this.timeout(50000);
        await VscodeTestsUtils.ensureExtensionIsActivated();
        VscodeTestsSetup.setup();

        // Focus the view. Otherwise it will not be instantiated/resolved.
        await Vscode.commands.executeCommand("iar-configuration.focus");
        await new Promise((res, _) => setTimeout(res, 1000));
    });

    setup(function() {
        console.log("\n==========================================================" + this.currentTest!.title + "==========================================================\n");
    });

    suite("Clicking workbench updates model", () => {
        let addedMockWorkbench = false;

        test("Clicking workbench updates model", async() => {
            const workbenchModel = ExtensionState.getInstance().workbench;

            // We need at least two workbenches for this, so add a fake one if there is only one workbench
            if (workbenchModel.amount === 1) {
                addedMockWorkbench = true;
                workbenchModel.set(...workbenchModel.workbenches, {
                    name: "MockWorkbench",
                    builderPath: "MockWorkbench",
                    idePath: "MockWorkbench",
                    path: "MockWorkbench",
                    targetIds: [],
                    type: WorkbenchType.IDE,
                    version: { major: 0, minor: 0, patch: 0 }
                });
                // Wait for the view to redraw
                await new Promise((res, _) => setTimeout(res, 1000));
            }

            let indexToSelect = -1;
            for (let i = 0; i < workbenchModel.amount; i++) {
                if (i !== workbenchModel.selectedIndex) {
                    indexToSelect = i;
                    break;
                }
            }
            const modelChange = waitForModelChange(ExtensionState.getInstance().workbench);
            IarVsc.settingsView.selectFromDropdown(DropdownIds.Workbench, indexToSelect);
            await modelChange;

            Assert.strictEqual(ExtensionState.getInstance().workbench.selectedIndex, indexToSelect);
        });
        suiteTeardown(() => {
            if (addedMockWorkbench) {
                const workbenchModel = ExtensionState.getInstance().workbench;
                workbenchModel.set(...workbenchModel.workbenches.filter(wb => wb.name !== "MockWorkbench"));
            }
        });
    });

    test("Clicking project updates model", async() => {
        await VscodeTestsUtils.activateProject("BasicDebugging");
        Assert(ExtensionState.getInstance().project.selectedIndex !== 2, ExtensionState.getInstance().project.selected!.name);
        const modelChange = waitForModelChange(ExtensionState.getInstance().project);
        IarVsc.settingsView.selectFromDropdown(DropdownIds.Project, 2);
        await modelChange;

        Assert.strictEqual(ExtensionState.getInstance().project.selectedIndex, 2);
    });
    test("Clicking config updates model", async() => {
        await VscodeTestsUtils.activateProject("BasicDebugging");
        Assert(ExtensionState.getInstance().config.selectedIndex !== 1);
        const modelChange = waitForModelChange(ExtensionState.getInstance().config);
        IarVsc.settingsView.selectFromDropdown(DropdownIds.Configuration, 1);
        await modelChange;

        Assert.strictEqual(ExtensionState.getInstance().config.selectedIndex, 1);
    });
    test("Clicking argVar updates model", async() => {
        await VscodeTestsUtils.activateArgVarFile("ArgVarFile1.custom_argvars");
        Assert(ExtensionState.getInstance().argVarsFile.selectedIndex !== 1);
        const modelChange = waitForModelChange(ExtensionState.getInstance().argVarsFile);
        IarVsc.settingsView.selectFromDropdown(DropdownIds.ArgVarFile, 1);
        await modelChange;

        Assert.strictEqual(ExtensionState.getInstance().argVarsFile.selectedIndex, 1);
    });

    const waitForModelChange = function<T>(model: ListInputModel<T>) {
        return new Promise<void>((res, rej) => {
            let fulfilled = false;
            model.addOnSelectedHandler(() => {
                if (!fulfilled) {
                    fulfilled = true;
                    res();
                }
            });
            setTimeout(() => {
                if (!fulfilled) {
                    fulfilled = true;
                    rej(new Error("Timed out"));
                }
            }, 10000);
        });
    };
});