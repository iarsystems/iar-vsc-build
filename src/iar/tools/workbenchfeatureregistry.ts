/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/* eslint-disable comma-spacing */
import { Workbench, WorkbenchType } from "iar-vsc-common/workbench";

/**
 * Allows looking up feature support for a workbench based on its IDE platform version.
 * This can be used e.g. to handle API changes between platform versions or to handle bugs in specific platform versions.
 */
export namespace WorkbenchFeatures {
    type PlatformVersion = [number, number, number];
    // Exported for testing only
    export interface FeatureRequirement {
        baseVersion: PlatformVersion;
        minProductType: WorkbenchType,
        targetOverrides?: Record<string, PlatformVersion>;
    }

    /**
     * We make no attempt to support versions below this; some things may still work... */
    export const VSCodeIntegration: FeatureRequirement =
        { baseVersion: [8,0,0], minProductType: WorkbenchType.LEGACY_BX };
    /**
     * Whether this workbench can return project/configuration options via thrift.
     * Previous versions may fail to expand some argvars, see MAJ-156. */
    export const FetchProjectOptions: FeatureRequirement = {
        baseVersion: [9,1,1],
        minProductType: WorkbenchType.LEGACY_BX,
        targetOverrides: {
            // See IDE-6272
            rh850: [9,2,0],
            rl78:  [9,1,7],
            avr:   [9,1,7],
            riscv: [9,1,7],
        }
    };
    /**
     * Whether this workbench can return tool arguments (e.g. C-SPY command lines) via thrift.
     * Previous versions may fail to expand some argvars, see MAJ-156. */
    export const FetchToolArguments: FeatureRequirement =
        { baseVersion: [9,1,1], minProductType: WorkbenchType.LEGACY_BX };
    /**
     * Whether this workbench supports the SetNodeByIndex thrift procedure, which
     * fixes issues with the previous SetNode procedure. See VSC-233. */
    export const SetNodeByIndex: FeatureRequirement =
        { baseVersion: [9,1,1], minProductType: WorkbenchType.LEGACY_BX };
    /**
     * Whether this workbench removes nodes from the project tree when calling SetNodes with an
     * updated node that has had some of its children removed. Other workbench version will only add
     * new children, but not remove children. See VSC-122. */
    export const SetNodeCanRemoveNodes: FeatureRequirement
        = { baseVersion: [9,1,0], minProductType: WorkbenchType.LEGACY_BX };
    /**
     * Whether this workbench supports the thrift project manager. */
    export const ThriftPM: FeatureRequirement =
        { baseVersion: [9,0,11], minProductType: WorkbenchType.EXTENDED_BX };
    /**
     * Whether this workbench supports loading workspaces from the thrift project manager (e.g. to load .custom_argvars files). */
    export const PMWorkspaces: FeatureRequirement =
        { baseVersion: [9,1,1], minProductType: WorkbenchType.LEGACY_BX };


    /**
     * Checks whether a workbench version meets the given minimum version.
     */
    export function supportsFeature(workbench: Workbench, requirement: FeatureRequirement, target?: string) {
        if (requirement.minProductType > workbench.type) {
            return false;
        }

        const minVer = calculateMinimumVersion(requirement, target ?? workbench.targetIds);
        const ewVersion: PlatformVersion = [workbench.version.major, workbench.version.minor, workbench.version.patch];
        return comparePlatformVersions(ewVersion, minVer) >= 0;
    }

    /**
     * Attemps to get the name of the product or products a workbench has to be upgraded to in order to meet the given minimum version.
     * E.g.: 'IAR Embedded Workbench for RISC-V 3.10'
     * Returns one product name for each target supported by the workbench.
     *
     * The returned strings each refer to a *product version*, which may be different from the IDE platform version (the platform version is not very meaningful to users).
     * This function may not return any names at all; it should not be relied upon for anything important,
     * only to give users a hint about the required product version(s).
     * @param workbench A workbench to check
     * @param minVer The version the workbench should meet
     */
    export function getMinProductVersions(workbench: Workbench, feature: FeatureRequirement): string[] {
        const preferredProductType = Math.max(workbench.type, feature.minProductType);

        return workbench.targetIds.map(target => {
            const minVer = calculateMinimumVersion(feature, target);

            const results: string[] = [];

            // Extended BX:s aren't always available, so we have to take special care with them
            const preferredMatch = getProductSatisfyingConstraints(minVer, target, preferredProductType);
            if (preferredMatch) {
                results.push(preferredMatch[1]);

                // We found a satisfactory extended BX, but there may also be an earlier IDE that satisfies the
                // requirement. In that case, recommend both products.
                if (preferredProductType === WorkbenchType.EXTENDED_BX && workbench.type === WorkbenchType.LEGACY_BX) {
                    const ideMatch = getProductSatisfyingConstraints(minVer, target, WorkbenchType.IDE);
                    if (ideMatch && ideMatch[0] < preferredMatch[0]) {
                        results.unshift(ideMatch[1]);
                    }
                }
            } else if (preferredProductType === WorkbenchType.EXTENDED_BX) {
                // We may have failed to find a product simply because there are no extended BX:s for this target,
                // so check for an IDE too.
                const ideMatch = getProductSatisfyingConstraints(minVer, target, WorkbenchType.IDE);
                if (ideMatch) {
                    results.push(ideMatch[1]);
                }
            }

            return results;
        }).flat();
    }

    // Calculates the minimum required ide version to support a feature for the given target(s)
    function calculateMinimumVersion(requirement: FeatureRequirement, targetIds: string | string[]): PlatformVersion {
        if (!Array.isArray(targetIds)) {
            targetIds = [targetIds];
        }

        let minVer = requirement.baseVersion;
        if (requirement.targetOverrides) {
            for (const targetId of targetIds) {
                const overrideVersion = requirement.targetOverrides[targetId];
                if (overrideVersion && comparePlatformVersions(minVer, overrideVersion) < 0) {
                    minVer = overrideVersion;
                }
            }
        }
        return minVer;
    }

    function comparePlatformVersions(a: PlatformVersion, b: PlatformVersion): number {
        for (let i = 0; i < 3; i++) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            if (a[i]! > b[i]!) {
                return 1;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            } else if (a[i]! < b[i]!) {
                return -1;
            }
        }
        return 0;
    }

    // If found, returns the platform version and display name of the minimum version product to satisfy the constraints.
    function getProductSatisfyingConstraints(
        platformVersion: PlatformVersion,
        target: string,
        type: WorkbenchType
    ): [PlatformVersion, string] | undefined {

        const productRelease = productReleasesFor(target).find(product => {
            return product.platformVersion >= platformVersion &&
                (type !== WorkbenchType.EXTENDED_BX || product.bxIsExtended);
        });
        if (productRelease === undefined) {
            return undefined;
        }

        const targetDisplayName = Workbench.getTargetDisplayName(target) ?? target;
        const productTypeName = type === WorkbenchType.IDE ? "Embedded Workbench" : "Build Tools";

        return [productRelease.platformVersion,
            "IAR " + productTypeName + " for " + targetDisplayName + " " + productRelease.productVersion];
    }

    class ProductRelease {
        constructor(
            public readonly platformVersion: PlatformVersion,
            // Whether the BX for this release is a WorkbenchType.EXTENDED_BX
            public readonly bxIsExtended: boolean,
            public readonly productVersion: string,
        ) {}
    }

    function productReleasesFor(target: string): ProductRelease[] {
        //! NOTE: entries MUST be inserted in ascending order
        const products: ProductRelease[] = [];

        if (target === "arm") {
            products.push(new ProductRelease([8,0,4], false, "8.10.1"));
            products.push(new ProductRelease([9,0,11], false, "9.20.4"));
            products.push(new ProductRelease([9,1,1], false, "9.30.1"));
        }
        if (target === "riscv") {
            products.push(new ProductRelease([8,3,2], false, "1.10"));
            products.push(new ProductRelease([9,1,0], false, "3.10.1"));
            products.push(new ProductRelease([9,1,3], false, "3.11.1"));
            products.push(new ProductRelease([9,1,7], false, "3.20.1"));
        }
        if (target === "430") {
            products.push(new ProductRelease([8,0,4], false, "7.10.1"));
            products.push(new ProductRelease([9,1,4], false, "8.10.1"));
        }
        if (target === "avr") {
            products.push(new ProductRelease([8,0,7], false, "7.10"));
            products.push(new ProductRelease([9,1,7], false, "8.10"));
        }
        if (target === "rh850") {
            products.push(new ProductRelease([8,1,1], false, "2.10"));
            products.push(new ProductRelease([9,1,2], false, "3.10"));
        }
        if (target === "rl78") {
            products.push(new ProductRelease([8,0,9], false, "3.10"));
            products.push(new ProductRelease([9,1,7], false, "5.10"));
        }
        if (target === "rx") {
            products.push(new ProductRelease([8,0,6], false, "3.10"));
        }
        if (target === "stm8") {
            products.push(new ProductRelease([8,1,2], false, "5.10"));
        }

        return products;
    }
}
