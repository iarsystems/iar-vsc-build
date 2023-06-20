/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Path from "path";
import * as Fs from "fs";
import { BatchBuildItem } from "iar-vsc-common/thrift/bindings/projectmanager_types";
import { OsUtils } from "iar-vsc-common/osUtils";

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
     * Transfer the set of batchbuild items to the backend.
     * @param items The set of batchbuild items to transfer.
     */
    setBatchBuilds(items: BatchBuildItem[]): Promise<void>;
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
        return Promise.resolve(undefined);
    }

    setBatchBuilds(_items: BatchBuildItem[]) {
        return Promise.resolve();
    }
}

/**
 * An Embedded Workbench project that is loaded through e.g. thrift, so we can
 * perform some additional operations on it.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ExtendedEwWorkspace extends EwWorkspace {

}

export namespace EwWorkspace {
    export async function equal(ws1: EwWorkspace, ws2: EwWorkspace): Promise<boolean> {
        if (!OsUtils.pathsEqual(ws1.path, ws2.path)) {
            return false;
        }
        for (let i = 0; i < Math.max(ws1.projects.length, ws2.projects.length); i++) {
            const p1 = ws1.projects[i];
            const p2 = ws2.projects[i];
            if (p1 === undefined || p2 === undefined || !OsUtils.pathsEqual(p1, p2)) {
                return false;
            }
        }

        const b1 = await ws1.getBatchBuilds();
        const b2 = await ws2.getBatchBuilds();
        return JSON.stringify(b1) === JSON.stringify(b2);
    }
}
