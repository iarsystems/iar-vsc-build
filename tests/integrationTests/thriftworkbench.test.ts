/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { ThriftWorkbench } from "../../src/iar/extendedworkbench";
import * as Assert from "assert";
import { Workbench } from "iar-vsc-common/workbench";
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

});