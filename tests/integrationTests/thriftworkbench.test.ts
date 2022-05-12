/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { ThriftWorkbench } from "../../src/iar/extendedworkbench";
import * as Assert from "assert";
import { Workbench } from "iar-vsc-common/workbench";
import { IntegrationTestsCommon } from "./common";
import { TestConfiguration } from "../testconfiguration";

suite("Thrift workbench", function() {
    let workbench: Workbench;

    suiteSetup(async function() {
        if (!TestConfiguration.getConfiguration().testThriftSupport) {
            this.skip();
            return;
        }

        const workbenches = await IntegrationTestsCommon.findWorkbenchesContainingTarget(TestConfiguration.getConfiguration().target);
        Assert(workbenches && workbenches.length > 0, "Found no suitable workbench to test with");

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