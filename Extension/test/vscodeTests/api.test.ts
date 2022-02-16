import * as Vscode from "vscode";
import * as Path from "path";
import * as Assert from "assert";
import { VscodeTestsUtils } from "./utils";
import { VscodeTestsSetup } from "./setup";
import { OsUtils } from "../../utils/osUtils";
import { ExtensionState } from "../../src/extension/extensionstate";
import { BuildExtensionApi } from "../../utils/buildExtension";

suite("Test Public TS Api", ()=>{
    let api: BuildExtensionApi;
    let ledFlasherPath: string;
    let basicDebuggingPath: string;

    suiteSetup(async function() {
        this.timeout(50000);
        await VscodeTestsUtils.ensureExtensionIsActivated();
        VscodeTestsSetup.setup();
        api = Vscode.extensions.getExtension("pluyckx.iar-vsc")!.exports;

        const sandboxPath = VscodeTestsSetup.setup();
        ledFlasherPath = Path.join(sandboxPath, "SourceConfiguration/IAR-STM32F429II-EXP/LedFlasher/LedFlasher.ewp");
        basicDebuggingPath = Path.join(sandboxPath, "GettingStarted/BasicDebugging.ewp");
    });

    test("Returns current workbench", async() => {
        const apiPath =  await api.getSelectedWorkbench();
        Assert.notStrictEqual(apiPath, undefined);
        Assert(OsUtils.pathsEqual(ExtensionState.getInstance().workbench.selected!.path.toString(), apiPath!), "The api did not returned the correct EW path: " + apiPath);
    });

    test("Returns loaded project", async() => {
        {
            await VscodeTestsUtils.activateProject("LedFlasher");
            const projPath = await api.getLoadedProject();
            Assert.strictEqual(projPath, ledFlasherPath);
        }
        {
            await VscodeTestsUtils.activateProject("BasicDebugging");
            const projPath = await api.getLoadedProject();
            Assert.strictEqual(projPath, basicDebuggingPath);
        }
    });

    test("Returns current configuration", async() => {
        {
            await VscodeTestsUtils.activateProject("LedFlasher");
            const config = await api.getSelectedConfiguration();
            Assert.strictEqual(config, "Flash Debug");
        }
        {
            await VscodeTestsUtils.activateProject("BasicDebugging");
            VscodeTestsUtils.activateConfiguration("Release");
            const config = await api.getSelectedConfiguration();
            Assert.strictEqual(config, "Release");
        }
    });
});