/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { IncludePath } from "./data/includepath";
import { Define } from "./data/define";
import * as Path from "path";
import { ListUtils, OsUtils } from "../../utils/utils";
import { PreIncludePath } from "./data/preincludepath";

/**
 * Stores source configuration (include paths/defines/preincludes) for a set of files.
 */
export class ConfigurationSet {
    private readonly includes: Map<string, IncludePath[]> = new Map();
    private readonly defines: Map<string, Define[]> = new Map();
    private readonly preincludes: Map<string, PreIncludePath[]> = new Map();

    // Used as fallback values e.g. for headers
    private readonly _allIncludes: IncludePath[] = [];
    private readonly _allDefines: Define[] = [];
    private readonly _allPreincludes: PreIncludePath[] = [];

    constructor(includes: Map<string, IncludePath[]>, defines: Map<string, Define[]>, preincludes: Map<string, PreIncludePath[]>) {
        // Normalize paths before we store them! This way it is safe to later look them up as strings
        // We also want to store all distinct include paths/defines/preincludes.
        includes.forEach((incs, file) => {
            this.includes.set(ConfigurationSet.normalizePath(file), incs);
        });
        this._allIncludes = ListUtils.mergeUnique(inc => inc.absolutePath.toString(), ...includes.values());

        defines.forEach((defs, file) => {
            this.defines.set(ConfigurationSet.normalizePath(file), defs);
        });
        this._allDefines = ListUtils.mergeUnique(def => def.makeString(), ...defines.values());

        preincludes.forEach((incs, file) => {
            this.preincludes.set(ConfigurationSet.normalizePath(file), incs);
        });
        this._allPreincludes = ListUtils.mergeUnique(inc => inc.absolutePath.toString(), ...preincludes.values());
    }

    getIncludes(file: string): IncludePath[] | undefined {
        return this.includes.get(ConfigurationSet.normalizePath(file));
    }
    getDefines(file: string): Define[] | undefined {
        return this.defines.get(ConfigurationSet.normalizePath(file));
    }
    getPreincludes(file: string): PreIncludePath[] | undefined {
        return this.preincludes.get(ConfigurationSet.normalizePath(file));
    }

    get allIncludes() {
        return this._allIncludes;
    }
    get allDefines() {
        return this._allDefines;
    }
    get allPreincludes() {
        return this._allPreincludes;
    }

    private static normalizePath(path: string) {
        path = Path.resolve(path);
        if (OsUtils.detectOsType() === OsUtils.OsType.Windows) {
            path = path.toLowerCase();
        }
        return path;
    }
}
