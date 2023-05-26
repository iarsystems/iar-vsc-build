/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import * as assert from "assert";
import { VscodeTestsUtils } from "./utils";
import { IarVsc } from "../../src/extension/main";
import { TestConfiguration } from "../testconfiguration";
import { BatchBuildItemNode, BatchBuildNode } from "../../src/extension/ui/treebatchbuildprovider";
import { ExtensionState } from "../../src/extension/extensionstate";
import { EwwFile } from "../../src/iar/workspace/ewwfile";
import path = require("path");
import { VscodeTestsSetup } from "./setup";
import { BatchBuild } from "../../src/extension/ui/batchbuildcommands";
import { FsUtils } from "../../src/utils/fs";

/**
 *  This is the test-suite for the batch build concept. It assures that we can load the
 *  defined batches from the eww file and build them accordingly.
 */

suite("Test batchbuild View", () => {
    let testRoot: string;

    suiteSetup(async function() {
        if (!TestConfiguration.getConfiguration().testThriftSupport) {
            this.skip();
            return;
        }

        if (TestConfiguration.getConfiguration().target !== "arm") {
            this.skip();
            return;
        }

        this.timeout(50000);
        await VscodeTestsUtils.doExtensionSetup();
        testRoot = VscodeTestsSetup.setup();

        if (!ExtensionState.getInstance().workspace.workspaces.find((workspace) => {
            return workspace.name === "TestProjects";
        })) {
            ExtensionState.getInstance().workspace.set(...ExtensionState.getInstance().workspace.workspaces, new EwwFile(path.join(testRoot, "TestProject.eww")));
        }

        await VscodeTestsUtils.activateWorkspace("TestProjects");
        // Give the files view time to refresh
        await new Promise((res, _) => setTimeout(res, 3000));
    });

    setup(function() {
        console.log("\n==========================================================" + this.currentTest!.title + "==========================================================\n");
    });

    test("Load batch-build from ws", () => {
        // Start by checking that the expected set of batches are available.
        const rootNode: BatchBuildNode = IarVsc.batchbuildTreeView._provider.rootNode;

        // Pre-packed with one batch.
        assert(rootNode.children.length === 1);

        const batchNode: BatchBuildNode | undefined = rootNode.children[0];

        // The workspace lists one batch named TestBatch with two included projects to work with.
        assert(batchNode !== undefined);
        assert(batchNode.name === "TestBatch");
        assert(batchNode.children.length === 2);

        const expectedPairs: string[] = ["BasicProject - Debug", "BasicProject - Release"];
        for (let i = 0; i < batchNode.children.length; i++) {
            assert(batchNode.children[i]?.name === expectedPairs[i], `${batchNode.children[i]?.name} != ${expectedPairs[i]}`);
        }

    });

    test("Execute batch commands", async() => {
        // Start by checking that the expected set of batches are available.
        const rootNode: BatchBuildNode = IarVsc.batchbuildTreeView._provider.rootNode;

        // Pre-packed with one batch.
        assert(rootNode.children.length === 1);

        const exeFiles: string[] = [];
        const buildItems: BatchBuildNode[] | undefined = rootNode.children[0]?.children;
        assert(buildItems);

        for (const item of buildItems) {
            if (item instanceof BatchBuildItemNode) {
                exeFiles.push(path.join(path.dirname(item.project), item.configurationName, "Exe", path.basename(item.project, ".ewp") + ".out"));
            }
        }


        // Clean the project and ensure that no remains exists.
        await VscodeTestsUtils.executeCommand("iar-build.cleanBatch", rootNode.children[0]);
        await VscodeTestsUtils.waitForTask((e => {
            return e.execution.task.name === BatchBuild.TaskNames.CleanBatch;
        }));
        for (const exeFile of exeFiles) {
            assert(!(await FsUtils.exists(exeFile)), `${exeFile} still exists, should have been cleaned`);
        }

        // Build the batch and make sure that we're successfully built the expected binaries.
        await VscodeTestsUtils.executeCommand("iar-build.buildBatch", rootNode.children[0]);
        await VscodeTestsUtils.waitForTask((e => {
            return e.execution.task.name === BatchBuild.TaskNames.BuildBatch;
        }));
        for (const exeFile of exeFiles) {
            assert((await FsUtils.exists(exeFile)), `${exeFile} does not exist, should have been built`);
        }
    });
});