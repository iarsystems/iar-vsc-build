/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import * as Fs from "fs";
import * as Jsonc from 'jsonc-parser';
import * as Path from "path";
import * as equal from "fast-deep-equal";
import { Config } from "../iar/project/config";
import { IncludePath } from "../iar/project/includepath";
import { PreIncludePath } from "../iar/project/preincludepath";
import { Define } from "../iar/project/define";
import { Compiler } from "../iar/tools/compiler";
import { FsUtils } from "../utils/fs";
import { Settings } from "../extension/settings";

export namespace CppToolsConfigGenerator {
    type loadConfigReturn = {
        config: any;
        error: Error | undefined;
    };

    export function generate(config?: Config, compiler?: Compiler, outPath?: Fs.PathLike): Error | undefined {
        if (!outPath) {
            let workspaceFolder = Vscode.workspace.rootPath;

            if (!workspaceFolder) {
                return new Error("No workspace folder opened.");
            }
            outPath = createDefaultOutputPath(workspaceFolder);
        }

        let obj = generateConfiguration(config, compiler);

        createOutDirectory(outPath);

        let { "error": errRet, "config": cpptoolsConfigFile } = loadConfiguration(outPath);
        if (errRet !== undefined) {
            return errRet;
        }

        if (setConfigurationIfChanged(cpptoolsConfigFile, "IAR", obj)) {
            Fs.writeFileSync(outPath, JSON.stringify(cpptoolsConfigFile, undefined, 4));
        }

        return undefined;
    }

    function toDefineArray(defines: Define[]): string[] {
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

    function toIncludePathArray(includes: IncludePath[], absolutePath: boolean = false): string[] {
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

    function toPreIncludePathArray(includes: PreIncludePath[]): string[] {
        let array: string[] = [];

        includes.forEach(item => {
            array.push(item.workspaceRelativePath.toString());
        });

        return array;
    }

    function createDefaultOutputPath(workspaceFolder: Fs.PathLike): Fs.PathLike {
        let vscodePath = Path.join(workspaceFolder.toString(), ".vscode");
        let defaultPath = Path.join(vscodePath, "c_cpp_properties.json");

        return defaultPath;
    }

    function loadConfiguration(path: Fs.PathLike): loadConfigReturn {
        let returnData: loadConfigReturn = {
            config: {},
            error: undefined
        };

        try {
            let stat = Fs.statSync(path);

            if (!stat.isFile()) {
                returnData.error = new Error("'${outPath}' is not a file");
                return returnData;
            }

            let content = Fs.readFileSync(path);
            returnData.config = Jsonc.parse(content.toString());

            if (returnData.config === undefined) {
                returnData.config = {};
            }

            if (returnData.config["version"] === undefined) {
                returnData.config["version"] = 4;
            }

            if (returnData.config["configurations"] === undefined) {
                returnData.config["configurations"] = [];
            }
        } catch (e) {
            if (returnData.config === undefined) {
                returnData.config = {};
            }

            returnData.config["version"] = 4;
            returnData.config["configurations"] = [];
        }

        return returnData;
    }

    function generateConfiguration(config?: Config, compiler?: Compiler): any {
        let obj: any = {};

        let defines: string[] = [];
        let includepaths: string[] = [];
        let preincludes: string[] = [];

        if (config) {
            defines = defines.concat(toDefineArray(config.defines));
            includepaths = includepaths.concat(toIncludePathArray(config.includes));
            preincludes = preincludes.concat(toPreIncludePathArray(config.preIncludes));
        }

        defines = defines.concat(Settings.getDefines());

        if (compiler) {
            defines = defines.concat(toDefineArray(compiler.defines));
            includepaths = includepaths.concat(toIncludePathArray(compiler.includePaths, true));
        }

        obj["name"] = "IAR";
        obj["defines"] = defines;
        obj["includePath"] = includepaths;
        obj["forcedInclude"] = preincludes;

        obj["cStandard"] = Settings.getCStandard();
        obj["cppStandard"] = Settings.getCppStandard();

        return obj;
    }

    function setConfigurationIfChanged(cpptoolsConfigFile: any, name: string, config: any): boolean {
        let configs = fetchConfigArray(cpptoolsConfigFile);
        let idx: number | undefined = undefined;

        configs.some((c, index) => {
            if (c["name"] === name) {
                idx = index;
            }

            return idx !== undefined;
        });

        if (idx === undefined) {
            configs.push(config);
            return true;
        } else {
            if (!equal(configs[idx], config)) {
                configs[idx] = config;
                return true;
            }
        }

        return false;
    }

    function fetchConfigArray(cpptoolsConfigFile: any): any[] {
        return cpptoolsConfigFile["configurations"];
    }

    function createOutDirectory(path: Fs.PathLike): void {
        let parsedPath = Path.parse(path.toString());

        if (parsedPath.dir) {
            FsUtils.mkdirsSync(parsedPath.dir);
        }
    }
}