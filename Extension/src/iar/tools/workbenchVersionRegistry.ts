/* eslint-disable comma-spacing */
import { Workbench } from "./workbench";

/**
 * Allows looking up information about a workbench based on its IDE platform version.
 * This can be used e.g. to handle API changes between versions or to handle bugs in specific versions.
 */
export namespace WorkbenchVersions {
    type FixVersion = [number, number, number];

    /**
     * We make no attempt to support versions below this; some things may still work... */
    export const supportsVSCode: FixVersion = [8,0,0];
    /**
     * Whether this workbench can return correct C-SPY command lines from the project
     * manager service. Previous versions may return incorrect command lines, see MAJ-156. */
    export const canFetchCSpyCommandLine: FixVersion = [9,1,1];
    /**
     * Whether this workbench supports the SetNodeByIndex thrift procedure, which
     * fixes issues with the previous SetNode procedure. See VSC-233.
     */
    export const supportsSetNodeByIndex: FixVersion = [9,1,1];

    /**
     * Checks whether a workbench version meets the given fix version.
     */
    export function doCheck(workbench: Workbench, fixVer: FixVersion) {
        const ewVersion = [workbench.version.major, workbench.version.minor, workbench.version.patch];
        for (let i = 0; i < 3; i++) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            if (ewVersion[i]! > fixVer[i]!) {
                return true;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            } else if (ewVersion[i]! < fixVer[i]!) {
                return false;
            }
        }
        return true;
    }
}
