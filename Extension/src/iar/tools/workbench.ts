/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Fs from "fs";
import * as Path from "path";
import { FsUtils } from "../../utils/fs";
import { ListUtils, OsUtils } from "../../utils/utils";
import { Platform } from "./platform";

const ideSubPath = "common/bin/IarIdePm.exe";
const builderSubPath = "common/bin/iarbuild" + (OsUtils.OsType.Windows === OsUtils.detectOsType() ? ".exe" : "");

export interface Workbench {
    readonly name: string;
    readonly path: Fs.PathLike;
    readonly idePath: Fs.PathLike;
    readonly platforms: Platform[];
}

class IarWorkbench implements Workbench {
    readonly platforms: Platform[];

    readonly path: Fs.PathLike;
    readonly idePath: Fs.PathLike;

    /**
     * Create a new Workbench object based using a path.
     * 
     * @param path The root path of the workbench. The folders *common* and
     *             *install-info* reside in the root folder.
     */
    constructor(path: Fs.PathLike) {
        this.path = path;
        this.idePath = Path.join(this.path.toString(), ideSubPath);

        if (!this.isValid()) {
            throw new Error("Path does not point to a workspace!");
        }

        this.platforms = Platform.collectPlatformsFrom(path, ["common", "install-info"]);
    }

    get name(): string {
        return Path.parse(this.path.toString()).base;
    }

    /**
     * Check if the workbench is valid. This means the IAR IDE is available.
     */
    protected isValid(): boolean {
        return Workbench.isValid(this.path);
    }
}

export namespace Workbench {
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
        let workbenches = new Array<Workbench>();

        let filter = FsUtils.createNonFilteredListDirectory();

        let directories = FsUtils.filteredListDirectory(root, filter);

        directories.forEach(directory => {
            let workbench = create(directory);

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
        let fnKey = (item: Workbench): string => {
            return item.path.toString();
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
        const idePath = Path.join(workbenchPath.toString(), builderSubPath);

        try {
            const stat = Fs.statSync(idePath);

            return stat.isFile();
        } catch (e) {
            return false;
        }
    }
}
