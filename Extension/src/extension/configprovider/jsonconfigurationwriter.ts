/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import * as Jsonc from "jsonc-parser";
import * as Path from "path";
import * as equal from "fast-deep-equal";
import { promises as fsPromises } from "fs";
import * as Fs from "fs";
import { Settings } from "../settings";
import { PartialSourceFileConfiguration } from "./data/partialsourcefileconfiguration";

/**
 * Writes a source file configuration to the 'c_cpp_properties.json' file.
 * This is both to have a fallback configuration if the TS API fails,
 * and to forcibly enable our TS config provider (by setting the 'configurationProvider' field in the json).
 */
export namespace JsonConfigurationWriter {
    // See reference for the format here: https://code.visualstudio.com/docs/cpp/c-cpp-properties-schema-reference
    interface CCppProperties {
        version?: number;
        configurations?: JsonConfiguration[];
    }
    interface JsonConfiguration {
        name: string;
        configurationProvider?: string;
        defines?: string[];
        includePath?: string[];
        forcedInclude?: string[];
        cStandard?: string;
        cppStandard?: string;
        compilerPath?: string;
        intelliSenseMode?: string;
        compileCommands?: string;
    }

    export async function writeJsonConfiguration(configuration: PartialSourceFileConfiguration, provider?: string) {
        const jsonConfiguration: JsonConfiguration = {
            name: "IAR",
            defines: configuration.defines.map(d => d.makeString()),
            includePath: configuration.includes.map(i => i.absolutePath.toString()),
            forcedInclude: configuration.preincludes.map(i => i.absolutePath.toString()),
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

        await createOutDirectory(outPath);

        const loadedConfig = await loadConfiguration(outPath);

        if (setConfigurationIfChanged(loadedConfig, "IAR", jsonConfiguration)) {
            // VSC-48 It seems if we do this async and write the config rapidly in succession
            // (such as in automatic tests), they will sometimes interfere with one another.
            // Do it synchronously instead.
            Fs.writeFileSync(outPath, JSON.stringify(loadedConfig, undefined, 4));
            // await fsPromises.writeFile(outPath, JSON.stringify(loadedConfig, undefined, 4));
        }
    }

    async function loadConfiguration(path: Fs.PathLike): Promise<CCppProperties> {
        let config: CCppProperties = {};
        try {
            const stat = await fsPromises.stat(path);

            if (!stat.isFile()) {
                throw new Error("'${outPath}' is not a file");
            }

            const content = await fsPromises.readFile(path);
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

    function setConfigurationIfChanged(cpptoolsConfigFile: CCppProperties, name: string, config: JsonConfiguration): boolean {
        const configs = fetchConfigArray(cpptoolsConfigFile);
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

    function fetchConfigArray(cpptoolsConfigFile: CCppProperties): JsonConfiguration[] {
        return cpptoolsConfigFile.configurations ?? [];
    }

    async function createOutDirectory(path: Fs.PathLike): Promise<void> {
        const parsedPath = Path.parse(path.toString());

        if (parsedPath.dir) {
            await fsPromises.mkdir(parsedPath.dir, { recursive: true });
        }
    }
}
