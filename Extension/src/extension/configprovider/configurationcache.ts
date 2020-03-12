/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Uri } from "vscode";
import { IncludePath } from "../../iar/project/includepath";
import { Define } from "../../iar/project/define";

/**
 * Caches project configuration data (include paths/defines).
 */
export interface ConfigurationCache {
    getIncludes(file: Uri): IncludePath[];
    putIncludes(file: Uri, includes: IncludePath[]): void;
    getDefines(file: Uri): Define[];
    putDefines(file: Uri, defines: Define[]): void;
}

/**
 * Maps file paths to their config data using a regular javascript object indexed by file path
 */
export class SimpleConfigurationCache {
    private includes: Record<string, IncludePath[]> = {};
    private defines: Record<string, Define[]> = {};

    // implementation idea:
    // have old provider supply a base set of config values, only files that deviate from this need special
    // storage. However, this might not work well for mixed c/c++ projects
    getIncludes(file: Uri): IncludePath[] {
        const cached = this.includes[file.path.toLowerCase()];
        return cached ? cached : [];
    }

    putIncludes(file: Uri, includes: IncludePath[]) {
        console.log(`Putting includes for ${file.path}`);
        console.log(includes);
        this.includes[file.path.toLowerCase()] = includes;
    }

    getDefines(file: Uri): Define[] {
        const cached = this.defines[file.path.toLowerCase()];
        return cached ? cached : [];
    }

    putDefines(file: Uri, defines: Define[]) {
        console.log(`Putting defines for ${file.path}`);
        console.log(defines);
        this.defines[file.path.toLowerCase()] = defines;
    }
}