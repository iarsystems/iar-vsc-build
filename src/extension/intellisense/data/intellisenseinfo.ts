/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import { IncludePath } from "./includepath";
import { PreIncludePath } from "./preincludepath";
import { Define } from "./define";

/**
 * The intellisense info we can generate for a source file from its project.
 * Other data may be able to be derived from these.
 */
export interface IntellisenseInfo {
    includes: IncludePath[];
    preincludes: PreIncludePath[];
    defines: Define[];
}
