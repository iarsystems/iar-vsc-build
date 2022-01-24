import * as Assert from "assert";
import * as Vscode from "vscode";
import { VscodeTestsUtils } from "./utils";
import { VscodeTestsSetup } from "./setup";
import { IarVsc } from "../../src/extension/main";
import { ExtensionState } from "../../src/extension/extensionstate";
import { DropdownIds } from "../../src/extension/ui/settingswebview";
import { ListInputModel } from "../../src/extension/model/model";


/**
 * Tests the interactivity of the settings view, i.e. that we can select dropdown options
 * and that that is propagated to the data models.
 */
suite("Test Clicking Settings View", ()=>{

    suiteSetup(async function() {
        this.timeout(50000);
        await VscodeTestsUtils.ensureExtensionIsActivated();
        VscodeTestsSetup.setup();

        await VscodeTestsUtils.activateProject("BasicDebugging");
        // Focus the view. Otherwise it will not be instantiated/resolved.
        await Vscode.commands.executeCommand("iar-settings.focus");
    });

    test("Clicking workbench updates model", async() => {
        const workbenchModel = ExtensionState.getInstance().workbench;
        if (workbenchModel.amount < 2) {
            console.error("This test can only run with at least two workbenches.");
            return;
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

    test("Clicking project updates model", async() => {
        await new Promise((res, _) => setTimeout(res, 2000));
        Assert(ExtensionState.getInstance().project.selectedIndex !== 0);
        const modelChange = waitForModelChange(ExtensionState.getInstance().project);
        IarVsc.settingsView.selectFromDropdown(DropdownIds.Project, 0);
        await modelChange;

        Assert.strictEqual(ExtensionState.getInstance().project.selectedIndex, 0);
    });
    test("Clicking config updates model", async() => {
        await VscodeTestsUtils.activateProject("BasicDebugging");
        Assert(ExtensionState.getInstance().config.selectedIndex !== 1);
        const modelChange = waitForModelChange(ExtensionState.getInstance().config);
        IarVsc.settingsView.selectFromDropdown(DropdownIds.Configuration, 1);
        await modelChange;

        Assert.strictEqual(ExtensionState.getInstance().config.selectedIndex, 1);
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