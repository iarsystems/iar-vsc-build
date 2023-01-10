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
    // These types are export for testing only
    export enum Type {
        BxAndEw,
        EwOnly,
    }
    type PlatformVersion = [number, number, number];
    export interface FeatureRequirement {
        baseVersion: PlatformVersion;
        type: Type,
        targetOverrides?: Record<string, PlatformVersion>;
    }

    /**
     * We make no attempt to support versions below this; some things may still work... */
    export const VSCodeIntegration: FeatureRequirement = { baseVersion: [8,0,0], type: Type.BxAndEw };
    /**
     * Whether this workbench can return project/configuration options via thrift.
     * Previous versions may fail to expand some argvars, see MAJ-156. */
    export const FetchProjectOptions: FeatureRequirement = {
        baseVersion: [9,1,1],
        type: Type.BxAndEw,
        targetOverrides: {
            // See IDE-6272
            rh850: [9,2,0],
            rl78:  [9,2,0],
            avr:   [9,2,0],
            riscv: [9,2,0],
        }
    };
    /**
     * Whether this workbench can return tool arguments (e.g. C-SPY command lines) via thrift.
     * Previous versions may fail to expand some argvars, see MAJ-156. */
    export const FetchToolArguments: FeatureRequirement = { baseVersion: [9,1,1], type: Type.BxAndEw };
    /**
     * Whether this workbench supports the SetNodeByIndex thrift procedure, which
     * fixes issues with the previous SetNode procedure. See VSC-233. */
    export const SetNodeByIndex: FeatureRequirement = { baseVersion: [9,1,1], type: Type.BxAndEw };
    /**
     * Whether this workbench removes nodes from the project tree when calling SetNodes with an
     * updated node that has had some of its children removed. Other workbench version will only add
     * new children, but not remove children. See VSC-122. */
    export const SetNodeCanRemoveNodes: FeatureRequirement = { baseVersion: [9,1,0], type: Type.BxAndEw };
    /**
     * Whether this workbench supports the thrift project manager. */
    export const ThriftPM: FeatureRequirement = { baseVersion: [9,0,11], type: Type.EwOnly };
    /**
     * Whether this workbench supports loading workspaces from the thrift project manager (e.g. to load .custom_argvars files). */
    export const PMWorkspaces: FeatureRequirement = { baseVersion: [9,1,1], type: Type.BxAndEw };


    /**
     * Checks whether a workbench version meets the given minimum version.
     */
    export function supportsFeature(workbench: Workbench, requirement: FeatureRequirement, target?: string) {
        if (requirement.type === Type.EwOnly && workbench.type === WorkbenchType.BX) {
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

        return workbench.targetIds.map(target => {
            const minVer = calculateMinimumVersion(feature, target);
            // Do we know the production version for this target and platform version?
            const minVersionString = `${minVer[0]}.${minVer[1]}.${minVer[2]}`;
            const productVersion = productVersionTable[target]?.[minVersionString];
            if (productVersion === undefined) {
                return undefined;
            }
            // It would be weird to recommend BX users to upgrade to EW, so
            // if they're using BX and BX meets the requirements we can return a BX product name.
            const useBuildTools = minVer[1] === Type.BxAndEw && workbench.type === WorkbenchType.BX;
            const targetDisplayName = Workbench.getTargetDisplayName(target) ?? target;

            return "IAR " + (useBuildTools ? "Build Tools" : "Embedded Workbench") + " for " + targetDisplayName + " " + productVersion;
        }).filter((product): product is string => !!product);
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

    // Maps IDE platform versions to (user-visible) product versions
    // Note that {@link getMinProductVersions} matches against exact fix versions. To be able to match
    // against a fix version for which there was no release for the target, you must add a "bogus" entry, see below.
    // We could try to match against the next release after the fix version, but that means we might return incorrect
    // product versions if we don't keep this table complete (and it is not complete ATM).
    const productVersionTable: { [target: string]: { [ver: string]: string} } = {
        "arm": {
            "8.0.0": "8.10.1", // there wasn't actually a release using 8.0.0, but add it so we can match the supportsVSCode FixVersion
            "8.0.4": "8.10.1",
            "9.0.11": "9.20.4",
            "9.1.0": "9.30.1", // not a real release
            "9.1.1": "9.30.1",
        },
        "riscv": {
            "8.0.0": "1.10", // not a real release
            "8.3.2": "1.10",
            "9.1.0": "3.10.1",
            "9.1.1": "3.11.1", // not a real release
            "9.1.3": "3.11.1",
        },
        "430": {
            "8.0.0": "7.10.1", // not a real release
            "8.0.4": "7.10.1",
        },
        "avr": {
            "8.0.0": "7.10", // not a real release
            "8.0.7": "7.10",
        },
        "rh850": {
            "8.0.0": "2.10", // not a real release
            "8.1.1": "2.10",
            "9.0.11": "3.10", // not a real release
            "9.1.0": "3.10", // not a real release
            "9.1.1": "3.10", // not a real release
            "9.1.2": "3.10",
        },
        "rl78": {
            "8.0.0": "3.10", // not a real release
            "8.0.9": "3.10",
        },
        "rx": {
            "8.0.0": "3.10", // not a real release
            "8.0.6": "3.10",
        },
        "stm8": {
            "8.0.0": "5.10", // not a real release
            "8.1.2": "5.10",
        },
    };
}
