/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import { IncludePath } from "./includepath";
import { PreIncludePath } from "./preincludepath";
import { Define } from "./define";

/**
 * The parts of a source file configuration we need to generate. Other parts are either irrelevent, or found from settings.
 */
export interface PartialSourceFileConfiguration {
    includes: IncludePath[];
    preincludes: PreIncludePath[];
    defines: Define[];
}
