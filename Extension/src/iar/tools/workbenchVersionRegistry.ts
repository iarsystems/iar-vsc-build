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
     * Whether this workbench can return correct C-SPY command lines from the project
     * manager service. Previous versions may return incorrect command lines, see MAJ-156. */
    export const canFetchCSpyCommandLine: MinVersion = [[9,1,1], Type.EwOnly];
    /**
     * Whether this workbench supports the SetNodeByIndex thrift procedure, which
     * fixes issues with the previous SetNode procedure. See VSC-233.
     */
    export const supportsSetNodeByIndex: MinVersion = [[9,1,1], Type.BxAndEw];


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

    // Checks whether a workbench is a Build Tools. This might misclassify really old EW version, but that's ok.
    function isBuildTools(workbench: Workbench): boolean {
        return Fs.existsSync(Path.join(workbench.path.toString(), "common/bin/CSpyServer" + IarOsUtils.executableExtension())) ||
            Fs.existsSync(Path.join(workbench.path.toString(), "common/bin/CSpyServer2" + IarOsUtils.executableExtension()));

    }
}
