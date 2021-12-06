import * as Assert from "assert";
import * as Path from "path";
import { ThriftWorkbench } from "../../src/iar/extendedworkbench";
import { Project } from "../../src/iar/project/project";
import { Configuration, Node, NodeType } from "../../src/iar/project/thrift/bindings/projectmanager_types";
import { ThriftProject } from "../../src/iar/project/thrift/thriftproject";
import { IntegrationTestsCommon } from "./common";
import { TestSandbox } from "../../utils/testutils/testSandbox";

suite("Thrift project", function() {
    this.timeout(0);

    let workbench: ThriftWorkbench;
    let sandbox: TestSandbox;
    let projectPath: string;

    suiteSetup(async() => {
        const workbenches = IntegrationTestsCommon.findWorkbenchesContainingTarget("arm");
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

    test("Managing configurations", async() => {
        await project.addConfiguration(new Configuration({ name: "TestConfig", toolchainId: "ARM"}), false);
        Assert.equal(project.configurations.length, 3);
        await project.removeConfiguration(new Configuration({ name: "TestConfig", toolchainId: "ARM"}));
        Assert.equal(project.configurations.length, 2);
    });

    test("Managing nodes", async() => {
        const rootNode = await project.getRootNode();
        Assert(rootNode);
        const sourceNode = rootNode.children[0];
        Assert(sourceNode);
        Assert.equal(sourceNode.type, NodeType.File);
        Assert.equal(sourceNode.name, IntegrationTestsCommon.TEST_PROJECT_SOURCE_FILE);
        Assert.equal(sourceNode.path, Path.join(projectPath, IntegrationTestsCommon.TEST_PROJECT_SOURCE_FILE));
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
        })];
        await project.setNode(rootNode);

        const updatedRootNode = await project.getRootNode();
        Assert(updatedRootNode);
        const groupNode = rootNode.children[0];
        Assert(groupNode !== undefined);
        Assert.equal(groupNode.type, NodeType.Group);
        Assert.equal(groupNode.name, "TestGroup");
    });

});