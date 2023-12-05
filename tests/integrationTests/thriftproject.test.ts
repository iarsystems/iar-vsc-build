/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import * as Assert from "assert";
import * as Path from "path";
import { ThriftWorkbench } from "../../src/iar/extendedworkbench";
import { Node, NodeType } from "iar-vsc-common/thrift/bindings/projectmanager_types";
import { IntegrationTestsCommon } from "./common";
import { TestSandbox } from "iar-vsc-common/testutils/testSandbox";
import { TestConfiguration } from "../testconfiguration";
import { OsUtils } from "iar-vsc-common/osUtils";
import { ExtendedProject } from "../../src/iar/project/project";

suite("Thrift project", function() {
    this.timeout(0);

    let workbench: ThriftWorkbench;
    let sandbox: TestSandbox;
    let projectPath: string;

    suiteSetup(async function() {
        if (!TestConfiguration.getConfiguration().testThriftSupport) {
            this.skip();
            return;
        }

        const workbenches = await IntegrationTestsCommon.findWorkbenchesContainingTarget(TestConfiguration.getConfiguration().target);
        Assert(workbenches && workbenches.length > 0, "Found no suitable workbench to test with");

        const workbenchCandidate = workbenches?.find(wb => ThriftWorkbench.hasThriftSupport(wb) );
        Assert(workbenchCandidate, "These tests require a project manager-enabled EW to run, but none was found.");

        workbench = await ThriftWorkbench.from(workbenchCandidate!);
        Assert(workbench, "Thrift workbench did not load correctly");

        sandbox = new TestSandbox(IntegrationTestsCommon.PROJECT_ROOT);
    });
    suiteTeardown(async() => {
        await workbench?.dispose();
    });

    let project: ExtendedProject;

    setup(async() => {
        projectPath = sandbox.copyToSandbox(TestConfiguration.getConfiguration().integrationTestProjectsDir, "IntegrationTestProject");
        const workspace = await workbench.loadAnonymousWorkspace([Path.join(projectPath, IntegrationTestsCommon.TEST_PROJECT_NAME)]);
        const proj = await workspace.getExtendedProject(workspace.projects.items[0]);
        Assert(proj);
        project = proj;
    });

    test("Managing nodes", async() => {
        const rootNode = await project.getRootNode();
        Assert(rootNode);
        const sourceNode = rootNode.children.find(node => node.name === IntegrationTestsCommon.TEST_PROJECT_SOURCE_FILE);
        Assert(sourceNode, "No 'main.c' file found in project");
        Assert.strictEqual(sourceNode.type, NodeType.File);
        Assert(OsUtils.pathsEqual(sourceNode.path, Path.join(projectPath, IntegrationTestsCommon.TEST_PROJECT_SOURCE_FILE)));
        rootNode.children = [new Node({
            name: "TestGroup",
            children: [sourceNode],
            path: "",
            type: NodeType.Group,
            childrenHaveLocalSettings: false,
            hasLocalSettings: false,
            hasRelevantSettings: false,
            isExcludedFromBuild: false,
            isMfcEnabled: false,
            isGenerated: false,
            controlFilePlugins: [],
        })];
        await project.setNode(rootNode, []);

        const updatedRootNode = await project.getRootNode();
        Assert(updatedRootNode);
        Assert.strictEqual(updatedRootNode.children.length, 1);
        const groupNode = rootNode.children[0];
        Assert(groupNode !== undefined);
        Assert.strictEqual(groupNode.type, NodeType.Group);
        Assert.strictEqual(groupNode.name, "TestGroup");
        Assert.strictEqual(groupNode.children[0]?.name, sourceNode.name);
    });

    // VSC-300 Generated nodes (e.g. output files) should not be included in the nodes from getRootNode()
    test("No generated nodes", async() => {
        const rootNode = await project.getRootNode();
        const assertNoGeneratedDescendants = (node: Node) =>{
            Assert(!node.isGenerated, "Found the following generated node: " + JSON.stringify(node));
            node.children.forEach(child => assertNoGeneratedDescendants(child));
        };
        assertNoGeneratedDescendants(rootNode);
    });
});