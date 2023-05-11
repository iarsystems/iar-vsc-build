/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

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
}