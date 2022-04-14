import * as Assert from "assert";
import * as Path from "path";
import { ThriftWorkbench } from "../../src/iar/extendedworkbench";
import { Project } from "../../src/iar/project/project";
import { Node, NodeType } from "iar-vsc-common/thrift/bindings/projectmanager_types";
import { ThriftProject } from "../../src/iar/project/thrift/thriftproject";
import { IntegrationTestsCommon } from "./common";
import { TestSandbox } from "iar-vsc-common/testutils/testSandbox";

suite("Thrift project", function() {
    this.timeout(0);

    let workbench: ThriftWorkbench;
    let sandbox: TestSandbox;
    let projectPath: string;

    suiteSetup(async() => {
        const workbenches = await IntegrationTestsCommon.findWorkbenchesContainingTarget("arm");
        Assert(workbenches && workbenches.length > 0, "These tests require an ARM EW to run, but none was found.");

        const workbenchCandidate = workbenches?.find(wb => ThriftWorkbench.hasThriftSupport(wb) );
        Assert(workbenchCandidate, "These tests require a project manager-enabled EW to run, but none was found.");

        workbench = await ThriftWorkbench.from(workbenchCandidate!);
        Assert(workbench, "Thrift workbench did not load correctly");

        sandbox = new TestSandbox(IntegrationTestsCommon.PROJECT_ROOT);
    });
    suiteTeardown(async() => {
        await workbench?.dispose();
    });

    let project: ThriftProject;

    setup(async() => {
        projectPath = sandbox.copyToSandbox(IntegrationTestsCommon.TEST_PROJECTS_DIR, "IntegrationTestProject");
        project = await workbench.loadProject(new Project(Path.join(projectPath, IntegrationTestsCommon.TEST_PROJECT_NAME)));
        Assert(project);
    });
    teardown(async() => {
        await project?.unload();
    });

    test("Managing nodes", async() => {
        const rootNode = await project.getRootNode();
        Assert(rootNode);
        const sourceNode = rootNode.children.find(node => node.name === IntegrationTestsCommon.TEST_PROJECT_SOURCE_FILE);
        Assert(sourceNode, "No 'main.c' file found in project");
        Assert.strictEqual(sourceNode.type, NodeType.File);
        Assert.strictEqual(sourceNode.path, Path.join(projectPath, IntegrationTestsCommon.TEST_PROJECT_SOURCE_FILE));
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

});