/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Uri } from "vscode";
import { IncludePath } from "./includepath";
import { Define } from "./define";

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
export class SimpleConfigurationCache implements ConfigurationCache {
    private includes: Record<string, IncludePath[]> = {};
    private defines: Record<string, Define[]> = {};

    getIncludes(file: Uri): IncludePath[] {
        const cached = this.includes[file.path.toLowerCase()];
        return cached ? cached : [];
    }

    putIncludes(file: Uri, includes: IncludePath[]) {
        this.includes[file.path.toLowerCase()] = includes;
    }

    getDefines(file: Uri): Define[] {
        const cached = this.defines[file.path.toLowerCase()];
        return cached ? cached : [];
    }

    putDefines(file: Uri, defines: Define[]) {
        this.defines[file.path.toLowerCase()] = defines;
    }
}