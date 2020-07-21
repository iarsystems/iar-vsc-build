import * as Assert from "assert";
import { copyFileSync, unlinkSync, existsSync } from "fs";
import * as path from "path";
import { Settings } from "../../src/extension/settings";
import { ThriftWorkbench } from "../../src/iar/extendedworkbench";
import { Project } from "../../src/iar/project/project";
import { Configuration, Node, NodeType } from "../../src/iar/project/thrift/bindings/projectmanager_types";
import { ToolManager } from "../../src/iar/tools/manager";
import { ThriftProject } from "../../src/iar/project/thrift/thriftproject";

const TEST_PROJECT_FILE = path.resolve(__dirname, "../../../test/ewpFiles/test_project.ewp");
const TEST_PROJECT_COPY = path.resolve(__dirname, "../../../test/ewpFiles/test_project_copy.ewp");
const TEST_SOURCE_FILE = path.resolve(__dirname, "../../../test/ewpFiles/main.c");

suite("Thrift project", function() {
    this.timeout(0);

    let workbench: ThriftWorkbench;

    suiteSetup(async () => {
        let manager = ToolManager.createIarToolManager();
        Settings.getIarInstallDirectories().forEach(directory => {
            manager.collectFrom(directory);
        });

        const workbenches = manager.findWorkbenchesContainingPlatform("arm");
        Assert(workbenches && workbenches.length > 0, "These tests require an ARM EW to run, but none was found.");

        const workbenchCandidate = workbenches?.find(wb => ThriftWorkbench.hasThriftSupport(wb) );
        Assert(workbenchCandidate, "These tests require a project manager-enabled EW to run, but none was found.");

        workbench = await ThriftWorkbench.from(workbenchCandidate!!);
    });
    suiteTeardown(async () => {
        await workbench.dispose();
        unlinkSync(TEST_PROJECT_COPY);
        const depFile = TEST_PROJECT_COPY.replace(".ewp", ".dep");
        if (existsSync(depFile)) {
            unlinkSync(depFile);
        }
        const ewtFile = TEST_PROJECT_COPY.replace(".ewp", ".ewt");
        if (existsSync(ewtFile)) {
            unlinkSync(ewtFile);
        }
    });

    let project: ThriftProject;

    setup(async () => {
        copyFileSync(TEST_PROJECT_FILE, TEST_PROJECT_COPY);
        project = await workbench.loadProject(new Project(TEST_PROJECT_COPY));
        Assert(project);
    });
    teardown(async () => {
        await project.unload();
    })

    test("Managing configurations", async () => {
        await project.addConfiguration(new Configuration({ name: "TestConfig", toolchainId: "ARM"}), false);
        Assert.equal(project.configurations.length, 3);
        await project.removeConfiguration(new Configuration({ name: "TestConfig", toolchainId: "ARM"}));
        Assert.equal(project.configurations.length, 2);
    });

    test("Managing nodes", async () => {
        const rootNode = await project.getRootNode();
        Assert(rootNode);
        const sourceNode = rootNode.children[0];
        Assert(sourceNode);
        Assert.equal(sourceNode.type, NodeType.File);
        Assert.equal(sourceNode.name, "main.c");
        Assert.equal(sourceNode.path, TEST_SOURCE_FILE);
        rootNode.children = [new Node({name: "TestGroup", children: [sourceNode], path: "", type: NodeType.Group})];
        await project.setNode(rootNode);

        const updatedRootNode = await project.getRootNode();
        Assert(updatedRootNode);
        const groupNode = rootNode.children[0];
        Assert.equal(groupNode.type, NodeType.Group);
        Assert.equal(sourceNode.name, "TestGroup");
    });
  
});