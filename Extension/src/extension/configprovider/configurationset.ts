/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { IncludePath } from "./data/includepath";
import { Define } from "./data/define";
import * as Path from "path";
import { OsUtils } from "../../utils/utils";

/**
 * Stores source configuration (include paths/defines) for a set of files.
 */
export class ConfigurationSet {
    private readonly includes: Map<string, IncludePath[]> = new Map();
    private readonly defines: Map<string, Define[]> = new Map();

    // Used as fallback values e.g. for headers
    private readonly _allIncludes: IncludePath[] = [];
    private readonly _allDefines: Define[] = [];

    constructor(includes: Map<string, IncludePath[]>, defines: Map<string, Define[]>) {
        // Normalize paths before we store them! This way it is safe to later look them up as strings
        // We also want to store all distinct include paths/defines. Using hashmaps to detect collissions should make this O(n).
        const foundIncludes: Record<string, boolean> = {};
        includes.forEach((incs, file) => {
            this.includes.set(ConfigurationSet.normalizePath(file), incs);
            incs.forEach(inc => {
                if (!foundIncludes[inc.absolutePath.toString()]) {
                    foundIncludes[inc.absolutePath.toString()] = true;
                    this._allIncludes.push(inc);
                }
            });
        });
        const foundDefines: Record<string, boolean> = {};
        defines.forEach((defs, file) => {
            this.defines.set(ConfigurationSet.normalizePath(file), defs);
            defs.forEach(def => {
                if (!foundDefines[def.makeString()]) {
                    foundDefines[def.makeString()] = true;
                    this._allDefines.push(def);
                }
            });
        });
    }

    getIncludes(file: string): IncludePath[] | undefined {
        return this.includes.get(ConfigurationSet.normalizePath(file));
    }
    getDefines(file: string): Define[] | undefined {
        return this.defines.get(ConfigurationSet.normalizePath(file));
    }

    get allIncludes() {
        return this._allIncludes;
    }
    get allDefines() {
        return this._allDefines;
    }

    private static normalizePath(path: string) {
        path = Path.format(Path.parse(Path.resolve(path)));
        if (OsUtils.detectOsType() === OsUtils.OsType.Windows) {
            path = path.toLowerCase();
        }
        return path;
    }
}
