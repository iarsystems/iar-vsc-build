import { ThriftWorkbench } from "../../src/iar/extendedworkbench";
import * as Assert from "assert";
import { Workbench } from "../../src/iar/tools/workbench";
import { IntegrationTestsCommon } from "./common";

suite("Thrift workbench", function() {
    let workbench: Workbench;

    suiteSetup(async() => {
        const workbenches = await IntegrationTestsCommon.findWorkbenchesContainingTarget("arm");
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