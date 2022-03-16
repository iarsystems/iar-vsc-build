/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import { spawnSync } from "child_process";
import * as Fs from "fs";
import * as Path from "path";
import { OsUtils } from "../../../utils/osUtils";
import { FsUtils } from "../../utils/fs";
import { ListUtils } from "../../utils/utils";

const ideSubPath = "common/bin/IarIdePm.exe";
const builderSubPath = "common/bin/iarbuild" + (OsUtils.OsType.Windows === OsUtils.detectOsType() ? ".exe" : "");

/**
 * An IAR toolchain (Embedded Workbench or Build Tools). To the user, this is refered to as a toolchain.
 * Note that they are not the related to the thrift Toolchain type.
 */
export interface Workbench {
    readonly name: string;
    readonly path: Fs.PathLike;
    // The path to iaridepm
    readonly idePath: Fs.PathLike;
    // The path to iarbuild
    readonly builderPath: Fs.PathLike;
    // The IDE platform version
    readonly version: WorkbenchVersion;
}

export interface WorkbenchVersion { major: number, minor: number, patch: number }

class IarWorkbench implements Workbench {
    private _version: WorkbenchVersion | undefined = undefined;

    readonly path: Fs.PathLike;
    readonly idePath: Fs.PathLike;
    readonly builderPath: Fs.PathLike;

    /**
     * Create a new Workbench object based using a path.
     *
     * @param path The root path of the workbench. The folders *common* and
     *             *install-info* reside in the root folder.
     */
    constructor(path: Fs.PathLike) {
        this.path = path;
        this.idePath = Path.join(this.path.toString(), ideSubPath);
        this.builderPath = Path.join(this.path.toString(), builderSubPath);

        if (!this.isValid()) {
            throw new Error("Path does not point to a an IAR Embedded Workbench or IAR Build Tools installation.");
        }
    }

    get name(): string {
        return Path.parse(this.path.toString()).base;
    }

    get version(): WorkbenchVersion {
        if (this._version === undefined) {
            const stdout = spawnSync(this.builderPath.toString()).stdout;
            const match = stdout.toString().match(/V(\d+)\.(\d+)\.(\d+)\.\d+/);
            if (match && match[1] !== undefined && match[2] !== undefined && match[3] !== undefined) {
                this._version = { major: parseInt(match[1]), minor: parseInt(match[2]), patch: parseInt(match[3]) };
            } else {
                this._version = { major: NaN, minor: NaN, patch: NaN };
            }
        }
        return this._version;
    }

    /**
     * Check if the workbench is valid. This means the IAR IDE is available.
     */
    protected isValid(): boolean {
        return Workbench.isValid(this.path);
    }
}

export namespace Workbench {
    export const ideSubPath = "common/bin/IarIdePm.exe";
    export const builderSubPath = "common/bin/iarbuild" + (OsUtils.OsType.Windows === OsUtils.detectOsType() ? ".exe" : "");

    /**
     * Search for valid workbenches. The found workbenches are stored in the
     * Workbench class and are accessible using the static accessor functions.
     *
     * @param root The root folder where we must search for valid workbench
     *             paths. By default this is `C:\Program Files (x86)\IAR Systems`.
     *
     * @returns {Workbench[]} A list of found workbenches. Size can be 0.
     */
    export function collectWorkbenchesFrom(root: Fs.PathLike): Workbench[] {
        const workbenches = new Array<Workbench>();

        const directories = FsUtils.filteredListDirectory(root, () => true);

        directories.forEach(directory => {
            const workbench = create(directory);

            if (workbench !== undefined) {
                workbenches.push(workbench);
            }
        });

        return workbenches;
    }

    /**
     * Merge two or more lists containing workbenches. This function will return
     * a list of unique workbenches. Duplicates are removed.
     *
     * @param list Array list containing lists of workbenches
     */
    export function mergeUnique(...lists: Array<Workbench>[]): Workbench[] {
        const fnKey = (item: Workbench): string => {
            return OsUtils.normalizePath(item.path.toString());
        };

        return ListUtils.mergeUnique(fnKey, ...lists);
    }


    /**
     * Create a new Workbench object and verify it.
     *
     * @param root the root path of the Workbench. See the constructor help for
     *             more information about this path.
     *
     * @returns undefined when the specified path is not the root of a valid
     *                    workbench path.
     * @returns Workbench when the specified path is a valid workbench path.
     */
    export function create(root: Fs.PathLike): Workbench | undefined {
        try {
            return new IarWorkbench(root);
        } catch (e) {
            return undefined;
        }
    }

    export function isValid(workbenchPath: Fs.PathLike): boolean {
        const builderPath = Path.join(workbenchPath.toString(), builderSubPath);

        try {
            const stat = Fs.statSync(builderPath);

            return stat.isFile();
        } catch (e) {
            return false;
        }
    }
}
