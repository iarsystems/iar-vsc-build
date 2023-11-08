/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Assert from "assert";
import * as Path from "path";
import * as Fs from "fs";
import { ExtensionState } from "../../src/extension/extensionstate";
import { VscodeTestsSetup } from "./setup";
import { VscodeTestsUtils } from "./utils";
import { tmpdir } from "os";
import { EwWorkspace } from "../../src/iar/workspace/ewworkspace";
import { TestConfiguration } from "../testconfiguration";

/**
 * Tests various parts of the extension using a project that requires a .custom_argvars file to be loaded.
 */
suite("Test workspace support", () => {
    let sandboxPath: string;

    suiteSetup(async function() {
        await VscodeTestsUtils.doExtensionSetup();
        sandboxPath = VscodeTestsSetup.setup();
    });

    setup(function() {
        console.log("\n==========================================================" + this.currentTest!.title + "==========================================================\n");
    });

    test("Finds workspaces in directory", ()=>{
        const allWorkspaces = ExtensionState.getInstance().workspace.workspaces;
        Assert(allWorkspaces.some(workspace => workspace.name === "ArgVars1"));
        Assert(allWorkspaces.some(workspace => workspace.name === "ArgVars2"));
        Assert(allWorkspaces.some(workspace => workspace.name === "TestProjects"));
    });

    test("Finds projects in workspace", async()=>{
        {
            await VscodeTestsUtils.activateWorkspace("TestProjects");
            const allProjects = ExtensionState.getInstance().project.projects;

            const expectCMakeProject = TestConfiguration.getConfiguration().testCMakeIntegration;
            Assert.strictEqual(allProjects.length, expectCMakeProject ? 4 : 3,
                "Found projects: " + allProjects.map(p => p.name).join(", "));
            Assert(allProjects.some(project => project.name === "BasicDebugging"));
            Assert(allProjects.some(project => project.name === "C-STATProject"));
            Assert(allProjects.some(project => project.name === "SourceConfiguration"));
            if (expectCMakeProject) {
                Assert(allProjects.some(project => project.name === "CMakeProject"));
            }
        }
        {
            await VscodeTestsUtils.activateWorkspace("ArgVars1");
            const allProjects = ExtensionState.getInstance().project.projects;
            Assert.strictEqual(allProjects.length, 1,
                "Found projects: " + allProjects.map(p => p.name).join(", "));
            Assert(allProjects.some(project => project.name === "ArgVars"));
        }
    });

    test("Check that creating/deleting workspaces affects extension state", async function() {
        this.timeout(40000);
        // Add a workspace file, make sure it is added to the extension
        const workspacePath = Path.join(sandboxPath, "newWorkspace.eww");
        Fs.copyFileSync(Path.join(sandboxPath, "TestProjects.eww"), workspacePath);
        // Give vs code time to react
        await new Promise((p, _) => setTimeout(p, 1000));
        Assert(ExtensionState.getInstance().workspace.workspaces.some(workspace => workspace.name === "newWorkspace"), "The created workspace was not added to the workspace list");

        // Remove the workspace file, make sure it is removed from the extension
        Fs.unlinkSync(workspacePath);
        // Give vs code time to react
        await new Promise((p, _) => setTimeout(p, 1000));
        Assert(!ExtensionState.getInstance().workspace.workspaces.some(workspace => workspace.name === "newWorkspace"), "The deleted workspace was not removed from the workspace list");
    });

    suite("", () => {
        let allWorkspaces: readonly EwWorkspace[];
        let tmpDir: string;

        teardown(() => {
            allWorkspaces.forEach(ws => {
                Fs.copyFileSync(Path.join(tmpDir, Path.basename(ws.path)), ws.path);
                Fs.unlinkSync(Path.join(tmpDir, Path.basename(ws.path)));
            });
        });

        test("Falls back to on-disk projects if there are no .eww files", async function() {
            allWorkspaces = ExtensionState.getInstance().workspace.workspaces;
            tmpDir = Path.join(tmpdir(), "vscode-iar-workspace-test");
            Fs.mkdirSync(tmpDir, { recursive: true });
            allWorkspaces.forEach(ws => {
                Fs.copyFileSync(ws.path, Path.join(tmpDir, Path.basename(ws.path)));
                Fs.unlinkSync(ws.path);
            });
            // Give vs code time to react
            await new Promise((p, _) => setTimeout(p, 4000));

            const allProjects = ExtensionState.getInstance().project.projects;
            const expectCMakeProject = TestConfiguration.getConfiguration().testCMakeIntegration;
            Assert.strictEqual(allProjects.length, expectCMakeProject ? 6 : 5,
                "Found projects: " + allProjects.map(p => p.name).join(", ") + " -> expected " + 6);
            Assert(allProjects.some(project => project.name === "ArgVars"));
            Assert(allProjects.some(project => project.name === "BasicDebugging"));
            Assert(allProjects.some(project => project.name === "C-STATProject"));
            Assert(allProjects.some(project => project.name === "SourceConfiguration"));
            if (expectCMakeProject) {
                Assert(allProjects.some(project => project.name === "CMakeProject"));
            }
        });
    });


});