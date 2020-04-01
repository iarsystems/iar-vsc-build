/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import { IncludePath } from "./includepath";
import { PreIncludePath } from "./preincludepath";
import { Define } from "./define";

export interface PartialSourceFileConfiguration {
    includes: IncludePath[];
    preIncludes: PreIncludePath[];
    defines: Define[];
}

export namespace PartialSourceFileConfiguration {
    export function merge(conf1: PartialSourceFileConfiguration, conf2: PartialSourceFileConfiguration): PartialSourceFileConfiguration {
        const conf1UniqueIncludes = conf1.includes.filter(path1 => !conf2.includes.some(path2 => path1.absolutePath === path2.absolutePath));
        const includes = conf1UniqueIncludes.concat(conf2.includes);

        const conf1UniquePreIncludes = conf1.preIncludes.filter(path1 => !conf2.preIncludes.some(path2 => path1.absolutePath === path2.absolutePath));
        const preIncludes = conf1UniquePreIncludes.concat(conf2.preIncludes);

        const conf1UniqueDefines = conf1.defines.filter(def1 => !conf2.defines.some(def2 => def1.identifier === def2.identifier));
        const defines = conf1UniqueDefines.concat(conf2.defines);
        return { includes, preIncludes, defines };
    }
}
