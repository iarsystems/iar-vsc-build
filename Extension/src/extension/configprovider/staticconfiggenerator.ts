/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import { Config } from "../../iar/project/config";
import { IncludePath } from "../../iar/project/includepath";
import { PreIncludePath } from "../../iar/project/preincludepath";
import { Define } from "../../iar/project/define";
import { Compiler } from "../../iar/tools/compiler";
import { LanguageUtils } from "../../utils/utils";

export type PartialSourceFileConfiguration = { includes: IncludePath[], preIncludes: PreIncludePath[], defines: Define[] };

/**
 * Detects source file configuration for an IAR project.
 * This implementation relies on static analysis of project files.
 * It is fast but sometimes inaccurate, and only generates on a project-level,
 * i.e. does not detect config changes between individual files.
 */
export namespace StaticConfigGenerator {

    export function generateConfiguration(language: LanguageUtils.Language, config?: Config, compiler?: Compiler): PartialSourceFileConfiguration {
        if (compiler !== undefined) {
            compiler.prepare();
        }

        let defines: Define[] = [];
        let includepaths: IncludePath[] = [];
        let preincludes: PreIncludePath[] = [];

        if (config) {
            if (language === "c") {
                defines = defines.concat(config.cDefines);
                includepaths = includepaths.concat(config.cIncludes);
            } else {
                defines = defines.concat(config.cppDefines);
                includepaths = includepaths.concat(config.cppIncludes);
            }

            preincludes = preincludes.concat(config.preIncludes);
        }

        if (compiler) {
            if (language === "c") {
                defines = defines.concat(compiler.cDefines);
                includepaths = includepaths.concat(compiler.cIncludePaths);
            } else {
                defines = defines.concat(compiler.cppDefines);
                includepaths = includepaths.concat(compiler.cppIncludePaths);
            }
        }

        return {
            includes: includepaths,
            preIncludes: preincludes,
            defines: defines,
        };
    }
}