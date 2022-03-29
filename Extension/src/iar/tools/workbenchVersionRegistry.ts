/* eslint-disable comma-spacing */
import { Workbench } from "./workbench";
import * as Fs from "fs";
import * as Path from "path";
import { IarOsUtils } from "../../../utils/osUtils";

/**
 * Allows looking up information about a workbench based on its IDE platform version.
 * This can be used e.g. to handle API changes between versions or to handle bugs in specific versions.
 */
export namespace WorkbenchVersions {
    enum Type {
        BxAndEw,
        EwOnly,
    }
    type MinVersion = [[number, number, number], Type];

    /**
     * We make no attempt to support versions below this; some things may still work... */
    export const supportsVSCode: MinVersion = [[8,0,0], Type.BxAndEw];
    /**
     * Whether this workbench can return correct options or tool arguments via thrift.
     * Previous versions may fail to expand some argvars, see MAJ-156. */
    export const canFetchProjectOptions: MinVersion = [[9,1,1], Type.BxAndEw];
    /**
     * Whether this workbench supports the SetNodeByIndex thrift procedure, which
     * fixes issues with the previous SetNode procedure. See VSC-233. */
    export const supportsSetNodeByIndex: MinVersion = [[9,1,1], Type.BxAndEw];
    /**
     * Whether this workbench supports the thrift project manager. */
    export const supportsThriftPM: MinVersion = [[9,0,11], Type.BxAndEw];


    /**
     * Checks whether a workbench version meets the given minimum version.
     */
    export function doCheck(workbench: Workbench, minVer: MinVersion) {
        if (minVer[1] === Type.EwOnly && isBuildTools(workbench)) {
            return false;
        }

        const ewVersion = [workbench.version.major, workbench.version.minor, workbench.version.patch];
        for (let i = 0; i < 3; i++) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            if (ewVersion[i]! > minVer[0][i]!) {
                return true;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            } else if (ewVersion[i]! < minVer[0][i]!) {
                return false;
            }
        }
        return true;
    }

    /**
     * Attemps to get the name of the product a workbench has to be upgraded to in order to meet the given minimum version.
     * The returned string includes a *product version*, which may be different from the IDE platform version (the platform version is not very meaningful to users).
     * This function may not return anything at all; it should not be relied upon for anything important,
     * only to give users a hint about the required product version.
     * @param workbench A workbench to check
     * @param minVer The version the workbench should meet
     */
    export function getMinProductVersion(workbench: Workbench, minVer: MinVersion): string | undefined {
        // Find the target
        let entries = Fs.readdirSync(workbench.path);
        entries = entries.filter(entry => !["install-info", "common"].includes(entry)).
            filter(entry => Fs.statSync(Path.join(workbench.path.toString(), entry)).isDirectory);
        const target = entries[0];
        if (target === undefined) {
            return undefined;
        }
        // Do we know the production version for this target and platform version?
        const minVersionString = `${minVer[0][0]}.${minVer[0][1]}.${minVer[0][2]}`;
        const productVersion = productVersionTable[target]?.[minVersionString];
        if (productVersion === undefined) {
            return undefined;
        }
        // It would be weird to recommend BX users to upgrade to EW, so
        // if they're using BX and BX meets the requirements we can return a BX product name.
        const useBuildTools = minVer[1] === Type.BxAndEw && isBuildTools(workbench);
        const targetDisplayName = targetDisplayNames[target] ?? target;

        return "IAR " + (useBuildTools ? "Build Tools" : "Embedded Workbench") + " for " + targetDisplayName + " " + productVersion;
        // Get the output type
        // construct the string
    }

    // Checks whether a workbench is a Build Tools. This might misclassify really old EW version, but that's ok.
    function isBuildTools(workbench: Workbench): boolean {
        return !Fs.existsSync(Path.join(workbench.path.toString(), "common/bin/CSpyServer" + IarOsUtils.executableExtension())) &&
            !Fs.existsSync(Path.join(workbench.path.toString(), "common/bin/CSpyServer2" + IarOsUtils.executableExtension()));

    }

    // Maps IDE platform versions to (user-visible) product versions
    // Note that {@link isBuildTools} matches against exact fix versions. To be able to match
    // against a fix version for which there was no release for the target, you must add a "bogus" entry, see below.
    // We could try to match against the next release after the fix version, but that means we might return incorrect
    // product versions if we don't keep this table complete (and it is not complete ATM).
    const productVersionTable: { [target: string]: { [ver: string]: string} } = {
        "arm": {
            "8.0.0": "8.10.1", // there wasn't actually a release using 8.0.0, but add it so we can match the supportsVSCode FixVersion
            "8.0.4": "8.10.1",
            "9.0.11": "9.20.4",
        },
        "riscv": {
            "8.0.0": "1.10", // not a real release
            "8.3.2": "1.10",
            "9.1.0": "3.10.1",
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
    const targetDisplayNames: { [target: string]: string } = {
        "arm":   "ARM",
        "riscv": "RISC-V",
        "430":   "MSP430",
        "avr":   "AVR",
        "rh850": "RH850",
        "rl78": "Renesas RL78",
        "rx": "Renesas RX",
        "stm8": "STM8"
    };
}
