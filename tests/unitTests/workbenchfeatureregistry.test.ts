/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Assert from "assert";
import { Workbench, WorkbenchType } from "iar-vsc-common/workbench";
import { WorkbenchFeatures } from "../../src/iar/tools/workbenchfeatureregistry";

suite("Test Workbench Version Registry", () => {
    suite("supportsFeature", () => {
        test("Respects base version", () => {
            const mockEW: { -readonly [P in keyof Workbench]: Workbench[P] } = {
                builderPath: "",
                idePath: "",
                name: "MockEW",
                path: "",
                targetIds: [],
                type: WorkbenchType.IDE,
                version: { major: 8, minor: 4, patch: 2},
            };
            const myFeature: WorkbenchFeatures.FeatureRequirement = {
                minProductType: WorkbenchType.LEGACY_BX,
                baseVersion: [9, 1, 0],
            };
            Assert(!WorkbenchFeatures.supportsFeature(mockEW, myFeature));
            mockEW.version = { major: 9, minor: 0, patch: 4 };
            Assert(!WorkbenchFeatures.supportsFeature(mockEW, myFeature));
            mockEW.version = { major: 9, minor: 1, patch: 0 };
            Assert(WorkbenchFeatures.supportsFeature(mockEW, myFeature));
            mockEW.version = { major: 9, minor: 2, patch: 0 };
            Assert(WorkbenchFeatures.supportsFeature(mockEW, myFeature));
        });

        test("Respects target overrides", () => {
            const mockEW: { -readonly [P in keyof Workbench]: Workbench[P] } = {
                builderPath: "",
                idePath: "",
                name: "MockEW",
                path: "",
                targetIds: ["arm", "rx"],
                type: WorkbenchType.IDE,
                version: { major: 9, minor: 1, patch: 0},
            };
            const myFeature: WorkbenchFeatures.FeatureRequirement = {
                minProductType: WorkbenchType.LEGACY_BX,
                baseVersion: [9, 1, 0],
                targetOverrides: {
                    "arm": [9, 2, 0],
                    "rx": [10, 1, 0],
                }
            };
            Assert(!WorkbenchFeatures.supportsFeature(mockEW, myFeature, "arm"));
            mockEW.version = { major: 9, minor: 2, patch: 0 };
            Assert(WorkbenchFeatures.supportsFeature(mockEW, myFeature, "arm"));
            Assert(!WorkbenchFeatures.supportsFeature(mockEW, myFeature));
            mockEW.version = { major: 10, minor: 1, patch: 0 };
            Assert(WorkbenchFeatures.supportsFeature(mockEW, myFeature));
        });

        test("Respects workbench type", () => {
            const mockEW: Workbench = {
                builderPath: "",
                idePath: "",
                name: "MockEW",
                path: "",
                targetIds: [],
                type: WorkbenchType.IDE,
                version: { major: 1, minor: 0, patch: 0},
            };
            const mockBX: Workbench = {
                builderPath: "",
                idePath: "",
                name: "MockBX",
                path: "",
                targetIds: [],
                type: WorkbenchType.EXTENDED_BX,
                version: { major: 1, minor: 0, patch: 0},
            };
            const myFeature: WorkbenchFeatures.FeatureRequirement = {
                minProductType: WorkbenchType.IDE,
                baseVersion: [1, 0, 0],
            };
            Assert(WorkbenchFeatures.supportsFeature(mockEW, myFeature));
            Assert(!WorkbenchFeatures.supportsFeature(mockBX, myFeature));
            myFeature.minProductType = WorkbenchType.EXTENDED_BX,
            Assert(WorkbenchFeatures.supportsFeature(mockBX, myFeature));
        });

    });
});
