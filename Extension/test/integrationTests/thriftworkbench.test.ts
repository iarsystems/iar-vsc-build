import { ThriftWorkbench } from "../../src/iar/extendedworkbench";
import { ToolManager } from "../../src/iar/tools/manager";
import { Settings } from "../../src/extension/settings";
import * as Assert from "assert";
import { Workbench } from "../../src/iar/tools/workbench";

suite("Thrift workbench", function() {
    let workbench: Workbench;

    suiteSetup(() => {
        const manager = ToolManager.createIarToolManager();
        Settings.getIarInstallDirectories().forEach(directory => {
            manager.collectFrom(directory);
        });

        const workbenches = manager.findWorkbenchesContainingPlatform("arm");
        Assert(workbenches && workbenches.length > 0, "These tests require an ARM EW to run, but none was found.");

        const workbenchCandidate = workbenches?.find(wb => ThriftWorkbench.hasThriftSupport(wb) );
        Assert(workbenchCandidate, "These tests require a project manager-enabled EW to run, but none was found.");

        workbench = workbenchCandidate!;
    });

    test("Can start registry", async() => {
        const thriftWb = await ThriftWorkbench.from(workbench);
        Assert(thriftWb);
        await thriftWb.dispose();
    });

    test("Provides toolchain(s)", async() => {
        const thriftWb = await ThriftWorkbench.from(workbench);
        Assert(thriftWb);
        const tcs = await thriftWb.getToolchains();
        Assert(tcs.some(tc => tc.id === "ARM"));

        await thriftWb.dispose();
    });

});