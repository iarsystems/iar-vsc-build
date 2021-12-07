/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Path from "path";
import * as Fs from "fs";

export interface PreIncludePath {
    readonly path: Fs.PathLike;
    readonly absolutePath: Fs.PathLike;
}

export class StringPreIncludePath implements PreIncludePath {
    private readonly includePath: Fs.PathLike;
    private readonly projectPath: Fs.PathLike | undefined;

    constructor(includePath: string, projectPath: string | undefined = undefined) {
        this.includePath = includePath;
        this.projectPath = projectPath;
    }

    get path(): Fs.PathLike {
        return this.includePath;
    }

    get absolutePath(): Fs.PathLike {
        if (this.projectPath === undefined) {
            return Path.resolve(this.includePath.toString());
        } else {
            const fullPath = this.includePath.toString().replace("$PROJ_DIR$", this.projectPath.toString());

            return Path.resolve(fullPath);
        }
    }
}
