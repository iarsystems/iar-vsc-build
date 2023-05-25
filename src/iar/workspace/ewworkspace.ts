/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Path from "path";
import * as Fs from "fs";
import { BatchBuildItem } from "iar-vsc-common/thrift/bindings/projectmanager_types";

/**
 * An Embedded Workbench workspace. This is unrelated to VS Code's workspace concept.
 */
export interface EwWorkspace {
    readonly name: string;
    readonly path: string;
    readonly projects: string[];

    /**
     * The .custom_argvars file belonging to the workspace, if one exists
     */
    getArgvarsFile(): string | undefined;

    /**
     * Get the list of batches that can be built. Eatch item consits of a name BatchBuildItem with
     * a vector of BuildItems which con
    */
    getBatchBuilds(): Promise<BatchBuildItem[] | undefined>;

    /**
     * Transfer the set of batchbuild items to the backend. Returns the backends vision of the build items.
     * @param items The set of batchbuild items to transfer.
     */
    setBatchBuilds(items: BatchBuildItem[]): Promise<BatchBuildItem[] | undefined>;
}

export abstract class EwWorkspaceBase implements EwWorkspace {
    abstract readonly path: string;
    abstract readonly projects: string[];

    get name(): string {
        return Path.basename(this.path, ".eww");
    }

    getArgvarsFile(): string | undefined {
        const argvarsPath = Path.join(
            Path.dirname(this.path),
            Path.basename(this.path, ".eww") + ".custom_argvars"
        );

        if (Fs.existsSync(argvarsPath)) {
            return argvarsPath;
        }
        return undefined;
    }

    getBatchBuilds(): Promise<BatchBuildItem[] | undefined> {
        return new Promise(() => {
            return undefined;
        });
    }

    setBatchBuilds(_items: BatchBuildItem[]): Promise<BatchBuildItem[] | undefined> {
        return new Promise(() => {
            return undefined;
        });
    }
}

/**
 * An Embedded Workbench project that is loaded through e.g. thrift, so we can
 * perform some additional operations on it.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ExtendedEwWorkspace extends EwWorkspace {

}
