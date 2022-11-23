/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Path from "path";

/**
 * A custom argument variable file (.custom_argvars). Contains user-defined variables which may be used in project
 * options. For projects that use such variables, a .custom_argvars file containing the variable definitions must be
 * provided when building or loading the project.
 */
export interface ArgVarsFile {
    name: string;
    path: string;
}

export namespace ArgVarsFile {
    export function fromFile(path: string) {
        return {
            name: Path.basename(path),
            path,
        };
    }
}