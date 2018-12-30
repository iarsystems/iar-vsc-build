
'use strict';

import * as Vscode from "vscode";
import * as Fs from "fs";
import * as Jsonc from 'jsonc-parser';
import * as Path from "path";
import { Config } from "../iar/project/config";
import { IncludePath } from "../iar/project/includepath";
import { PreIncludePath } from "../iar/project/preincludepath";
import { Define } from "../iar/project/define";
import { Compiler } from "../iar/tools/compiler";
import { FsUtils } from "../utils/fs";

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

        setConfiguration(cpptoolsConfigFile, "IAR", obj);

        Fs.writeFileSync(outPath, JSON.stringify(cpptoolsConfigFile, undefined, 4));

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

            if (returnData.config["configurations"] === undefined) {
                returnData.config["configurations"] = [];
            }
        } catch (e) {
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

        if (compiler) {
            defines = defines.concat(toDefineArray(compiler.defines));
            includepaths = includepaths.concat(toIncludePathArray(compiler.includePaths, true));
        }

        obj["name"] = "IAR";
        obj["defines"] = defines;
        obj["includePath"] = includepaths;
        obj["forcedInclude"] = preincludes;

        return obj;
    }

    function setConfiguration(cpptoolsConfigFile: any, name: string, config: any): void {
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
        } else {
            configs[idx] = config;
        }
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