import { Workbench } from "./workbench";

/**
 * Allows looking up information about a workbench based on its IDE platform version.
 * This can be used e.g. to handle API changes between versions or handle bugs in specific versions.
 */
export namespace WorkbenchVersionRegistry {
    // TODO: once we start adding more checks here, find a clearer way to express them.
    /**
     * Whether this workbench can return correct C-SPY command lines from the project
     * manager service. Previous versions may return incorrect command lines, see MAJ-156.
     */
    export function canFetchCSpyCommandLine(workbench: Workbench): boolean {
        const version = workbench.version;
        // Fix versions: 9.0.11 and 9.1.1
        return version.major > 9 ||
            (version.major === 9 && (
                (version.minor > 1 ||
                    (version.minor === 1 && version.patch > 0) ||
                    (version.minor === 0 && version.patch > 10)
                )));
    }
}