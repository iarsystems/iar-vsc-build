/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import { Config } from "../../iar/project/config";
import { IncludePath } from "../../iar/project/includepath";
import { PreIncludePath } from "../../iar/project/preincludepath";
import { Define } from "../../iar/project/define";
import { Compiler } from "../../iar/tools/compiler";
import { Settings } from "../settings";
import { SourceFileConfiguration } from "vscode-cpptools";
import { LanguageUtils } from "../../utils/utils";

/**
 * Detects source file configuration for an IAR project.
 * This implementation relies on static analysis of project files.
 * It is fast but sometimes inaccurate, and only generates on a project-level,
 * i.e. does not detect config changes between individual files.
 */
export class StaticConfigGenerator {

    public generateConfiguration(language: LanguageUtils.Language, config?: Config, compiler?: Compiler): SourceFileConfiguration {
        if (compiler !== undefined) {
            compiler.prepare();
        }

        let defines: string[] = [];
        let includepaths: string[] = [];
        let preincludes: string[] = [];

        if (config) {
            if (language === "c") {
                defines = defines.concat(this.toDefineArray(config.cDefines));
                includepaths = includepaths.concat(this.toIncludePathArray(config.cIncludes));
            } else {
                defines = defines.concat(this.toDefineArray(config.cppDefines));
                includepaths = includepaths.concat(this.toIncludePathArray(config.cppIncludes));
            }

            preincludes = preincludes.concat(this.toPreIncludePathArray(config.preIncludes));
        }

        if (compiler) {
            if (language === "c") {
                defines = defines.concat(this.toDefineArray(compiler.cDefines));
                includepaths = includepaths.concat(this.toIncludePathArray(compiler.cIncludePaths, true));
            } else {
                defines = defines.concat(this.toDefineArray(compiler.cppDefines));
                includepaths = includepaths.concat(this.toIncludePathArray(compiler.cppIncludePaths, true));
            }
        }

        return {
            defines: defines,
            includePath: includepaths,
            forcedInclude: preincludes,
            standard: (language === "cpp") ? Settings.getCppStandard() : Settings.getCStandard(),
            intelliSenseMode: "msvc-x64",
            compilerPath: "",
        };
    }

    toDefineArray(defines: Define[]): string[] {
        let array: string[] = [];

        defines.forEach(item => {
            if (item.value) {
                array.push(item.identifier + "=" + item.value);
            } else {
                array.push(item.identifier);
            }
        });

        return array;
    }

    toIncludePathArray(includes: IncludePath[], absolutePath: boolean = false): string[] {
        let array: string[] = [];

        includes.forEach(item => {
            if (absolutePath) {
                array.push(item.absolutePath.toString());
            } else {
                array.push(item.workspacePath.toString());
            }
        });

        return array;
    }

    toPreIncludePathArray(includes: PreIncludePath[]): string[] {
        let array: string[] = [];

        includes.forEach(item => {
            array.push(item.workspaceRelativePath.toString());
        });

        return array;
    }
}