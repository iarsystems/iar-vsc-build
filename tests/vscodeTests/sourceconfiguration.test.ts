/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import * as Assert from "assert";
import * as Vscode from "vscode";
import * as Path from "path";
import { IarConfigurationProvider } from "../../src/extension/cpptools/configurationprovider";
import { VscodeTestsUtils } from "./utils";
import { VscodeTestsSetup } from "./setup";
import { OsUtils } from "iar-vsc-common/osUtils";
import { ExtensionState } from "../../src/extension/extensionstate";
import { SourceFileConfiguration } from "vscode-cpptools";
import { Settings } from "../../src/extension/settings";
import { readdirSync } from "fs";
import { TestConfiguration } from "../testconfiguration";

suite("Test Source Configuration (intelliSense)", ()=>{
    const USER_DEFINE_1 = "MY_DEFINE";
    const USER_DEFINE_2 = "MY_DEFINE2='test'";

    let provider: IarConfigurationProvider;
    let projectDir: string;
    let libDir: string;

    let originalUserDefines: string[];

    suiteSetup(async function() {
        this.timeout(40000);
        const sandboxPath = VscodeTestsSetup.setup();
        projectDir = Path.join(sandboxPath, "SourceConfiguration/Project");
        libDir = Path.join(sandboxPath, "SourceConfiguration/Library");

        await VscodeTestsUtils.doExtensionSetup();
        await VscodeTestsUtils.activateProject("SourceConfiguration");
        originalUserDefines = Settings.getDefines();
        await Vscode.workspace.getConfiguration("iar-build").update("defines", originalUserDefines.concat([USER_DEFINE_1, USER_DEFINE_2]));

        const prov = IarConfigurationProvider.instance;
        Assert(prov, "Config provider should be initialized by now");
        await prov.forceUpdate();
        provider = prov;
    });

    suiteTeardown(() => {
        return Vscode.workspace.getConfiguration("iar-build").update("defines", originalUserDefines);
    });

    setup(function() {
        console.log("\n==========================================================" + this.currentTest!.title + "==========================================================\n");
    });

    // All files in this project have the same config, so we can reuse the assertions
    function assertConfig(config: SourceFileConfiguration) {
        const workbench = ExtensionState.getInstance().workbench.selected!;
        // Project config
        Assert(config.includePath.some(path => OsUtils.pathsEqual(path, projectDir)));
        Assert(config.includePath.some(path => OsUtils.pathsEqual(path, Path.join(libDir, "inc"))));
        Assert(config.defines.some(define => define === "USE_STDPERIPH_DRIVER=1"));
        Assert(config.defines.some(define => define === "HSE_VALUE=8000000"));
        // cmsis is not available on linux
        if (OsUtils.OsType.Windows === OsUtils.detectOsType() && TestConfiguration.getConfiguration().target === "arm") {
            Assert(config.includePath.some(path => OsUtils.pathsEqual(path, Path.join(workbench.path.toString(), "arm/CMSIS/Core/Include"))));
            Assert(config.includePath.some(path => OsUtils.pathsEqual(path, Path.join(workbench.path.toString(), "arm/CMSIS/Dsp/Include"))));
        }

        // Compiler config
        TestConfiguration.getConfiguration().defaultIncludePaths.forEach(includeRegex => {
            Assert(config.includePath.some(path => includeRegex.test(path)), `Found no include path matching ${includeRegex.source}`);
        });

        Assert(config.defines.some(define => define.match(new RegExp(`${TestConfiguration.getConfiguration().architectureDefine}=.+`))));
        Assert(config.defines.some(define => define.match(/__VERSION__=".+"/)));

        // User settings
        Assert(config.defines.some(define => define === USER_DEFINE_1));
        Assert(config.defines.some(define => define === USER_DEFINE_2));

        // IAR keywords
        Assert(config.defines.some(define => define === "__root="));
        Assert(config.defines.some(define => define === "__noreturn="));
    }

    test("Handles project files", async() => {
        let path = Path.join(projectDir, "main.c");
        Assert(provider.isProjectFile(path));
        let config = (await provider.provideConfigurations([Vscode.Uri.file(path)]))[0];
        console.log(JSON.stringify(config));
        assertConfig(config!.configuration);

        path = Path.join(libDir, "src/gpio.c");
        Assert(provider.isProjectFile(path));
        config = (await provider.provideConfigurations([Vscode.Uri.file(path)]))[0];
        assertConfig(config!.configuration);

        // check that no backup files were created (VSC-192)
        const backups = readdirSync(projectDir).filter(entry => entry.match(/Backup \(\d+\) of /));
        Assert.strictEqual(backups.length, 0, "The following backups were created: " + backups.join(", "));
    });

    test("Handles non-project files", async() => {
        let path = "thisfiledoesnotexist.c";
        Assert(!provider.isProjectFile(path));
        let config = (await provider.provideConfigurations([Vscode.Uri.file(path)]))[0];
        assertConfig(config!.configuration);

        path = Path.join(projectDir, "main.h");
        Assert(!provider.isProjectFile(path));
        config = (await provider.provideConfigurations([Vscode.Uri.file(path)]))[0];
        assertConfig(config!.configuration);
    });

    test("IntelliSense reports no errors", async() => {
        // This lets us test for false positive errors in intelliSense.
        // Since the project compiles, intelliSense shouldn't report any errors.

        // Regression test for:
        // VSC-290 (https://github.com/IARSystems/iar-vsc-build/issues/1), ms-style unnamed structs
        // VSC-299 (https://github.com/IARSystems/iar-vsc-build/issues/7), invalid macro definition

        await Vscode.commands.executeCommand("vscode.open", Vscode.Uri.file(Path.join(projectDir, "main.c")));
        // Give intelliSense some time to parse the file
        await new Promise((res, _) => setTimeout(res, 5000));
        const diagnostics = Vscode.languages.getDiagnostics().filter(diag =>
            !(Path.relative(projectDir, diag[0].fsPath).startsWith("..")) && (Path.relative(libDir, diag[0].fsPath).startsWith(".."))).
            filter(diag => diag[1].length > 0);
        Assert.deepStrictEqual(diagnostics, [], "intelliSense reported false positive(s)");
    });
});