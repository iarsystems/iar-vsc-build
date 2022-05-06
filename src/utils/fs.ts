/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as path from "path";
import * as fs from "fs";

export namespace FsUtils {
    // Node has no promise-based exists function
    export async function exists(p: fs.PathLike): Promise<boolean> {
        try {
            await fs.promises.access(p, fs.constants.R_OK);
            return true;
        } catch {
        }
        return false;
    }

    export async function filteredListDirectory(dirPath: string, filterCallback: (path: string) => boolean): Promise<string[]> {
        if (await FsUtils.exists(dirPath)) {
            const stat = await fs.promises.stat(dirPath);
            if (stat.isDirectory()) {
                const children = await fs.promises.readdir(dirPath);
                return children.map(child => path.join(dirPath, child)).filter(filterCallback);
            }
        }
        return [];
    }

    export function createFilteredListDirectoryFilenameRegex(regex: RegExp): (fullpath: string) => boolean {
        return (fullpath: string): boolean => {
            const stat = fs.statSync(fullpath);

            if (stat.isFile()) {
                const parsedPath = path.parse(fullpath.toString());
                const filename = parsedPath.base;

                return regex.test(filename);
            } else {
                return false;
            }
        };
    }
}