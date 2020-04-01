/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import * as Jsonc from "jsonc-parser";
import * as Fs from "fs";
import * as Path from "path";
import * as equal from "fast-deep-equal";
import { FsUtils } from "../../utils/fs";
import { Settings } from "../settings";
import { PartialSourceFileConfiguration } from "./data/partialsourcefileconfiguration";

/**
 * Writes a source file configuration to the 'c_cpp_properties.json' file.
 * This is both to have a fallback configuration if the TS API fails,
 * and to forcibly enable our TS config provider (by setting the 'provider' field in the json).
 */
export namespace JsonConfigurationWriter {

    export function writeJsonConfiguration(configuration: PartialSourceFileConfiguration, provider?: string) {
        let jsonConfiguration: any = {
            name: "IAR",
            defines: configuration.defines.map(d => d.makeString()),
            includePath: configuration.includes.map(i => i.absolutePath),
            forcedInclude: configuration.preIncludes.map(i => i.absolutePath),
            cStandard: Settings.getCStandard(),
            cppStandard: Settings.getCppStandard(),
            compilerPath: "",
            intelliSenseMode: "msvc-x64",
        };
        if (provider) {
            jsonConfiguration["configurationProvider"] = provider;
        }

        const workspaceFolder = Vscode.workspace.rootPath;
        if (!workspaceFolder) {
            throw new Error("No workspace folder opened.");
        }
        const vscodePath = Path.join(workspaceFolder, ".vscode");
        const outPath = Path.join(vscodePath, "c_cpp_properties.json");

        createOutDirectory(outPath);

        const loadedConfig = loadConfiguration(outPath);

        if (setConfigurationIfChanged(loadedConfig, "IAR", jsonConfiguration)) {
            Fs.writeFileSync(outPath, JSON.stringify(loadedConfig, undefined, 4));
        }
    }

    function loadConfiguration(path: Fs.PathLike): any {
        let config: any = {};
        try {
            let stat = Fs.statSync(path);

            if (!stat.isFile()) {
                throw new Error("'${outPath}' is not a file");
            }

            let content = Fs.readFileSync(path);
            config = Jsonc.parse(content.toString());

            if (config === undefined) {
                config = {};
            }

            if (config["version"] === undefined) {
                config["version"] = 4;
            }

            if (config["configurations"] === undefined) {
                config["configurations"] = [];
            }
        } catch (e) {
            if (config === undefined) {
                config = {};
            }

            config["version"] = 4;
            config["configurations"] = [];
        }

        return config;
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
