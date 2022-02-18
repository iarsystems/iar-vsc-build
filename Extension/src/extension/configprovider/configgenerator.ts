/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Project } from "../../iar/project/project";
import { Workbench } from "../../iar/tools/workbench";
import { Config } from "../../iar/project/config";
import * as Vscode from "vscode";
import { IncludePath } from "./data/includepath";
import { Define } from "./data/define";
import { join } from "path";
import { spawn, spawnSync } from "child_process";
import * as readline from "readline";
import { tmpdir } from "os";
import * as Path from "path";
import { LanguageUtils, ProcessUtils } from "../../utils/utils";
import { ConfigurationSet } from "./configurationset";
import * as fsPromises from "fs/promises";
import { FsUtils } from "../../utils/fs";
import { createHash } from "crypto";
import { PreIncludePath, StringPreIncludePath } from "./data/preincludepath";
import { Mutex, E_CANCELED as MUTEX_CANCELED } from "async-mutex";
import { Settings } from "../settings";

/**
 * A method or strategy of generating source configuration for a project. This needs to be pluggable, since the IarBuild
 * interface differs between EW versions.
 * @param workbench The workbench to use
 * @param project The project to generate source config for
 * @param project The project configuration to generate source config for
 * @param output A vscode output channel to print used feedback (e.g. compiler output to)
 * @return The configurations for all files in the project.
 */
type ConfigGeneratorImpl = (workbench: Workbench, project: Project, config: Config, output: Vscode.OutputChannel) => Promise<ConfigurationSet>;

/**
 * Generates/detects per-file configuration data (include paths/defines) for an entire project.
 * Prints some output (e.g. from iarbuild) to a {@link Vscode.OutputChannel}.
 */
export class ConfigGenerator {
    // Stores any running operation, so we don't run more than one at the same time. Essentially this creates a mutex lock.
    private readonly mutex = new Mutex();
    private readonly output: Vscode.OutputChannel = Vscode.window.createOutputChannel("Iar Config Generator");

    /** Thrown by {@link generateSourceConfigs} when it is canceled (i.e. superceded) */
    public static CanceledError = MUTEX_CANCELED;

    /**
     * Generates configuration data for an entire project, using the supplied values.
     * If any previous call is still running, waits for it to finish first.
     * While waiting, the call is canceled if a new call to this method is made.
     */
    public generateSourceConfigs(workbench: Workbench, project: Project, config: Config): Promise<ConfigurationSet> {
        const builder = workbench.builderPath.toString();

        // select how to generate configs for this workbench
        const builderOutput = spawnSync(builder).stdout.toString(); // Spawn without args to get help list
        let generator: ConfigGeneratorImpl;
        if (builderOutput.includes("-jsondb")) { // Filifjonkan
            generator = ConfigGenerator.generateForFilifjonkan;
        } else {
            generator = ConfigGenerator.generateForBeforeFilifjonkan;
        }

        const run = () => generator(workbench, project, config, this.output).then(
            result => {
                this.output.appendLine("Done!");
                return result;
            },
            err => {
                this.output.appendLine("Source configuration did not complete: " + err.message);
                console.error(err);
                return Promise.reject(err);
            }
        );
        // cancel any other waiter
        this.mutex.cancel();
        return this.mutex.runExclusive(run);
    }

    /**
     * Gives focus to the output channel in the UI (e.g. because an error occured that the user should see).
     */
    public showOutputChannel() {
        this.output.show(true);
    }


    public dispose() {
        this.output.dispose();
    }
}

/**
 * Actual source config implementations
 */
export namespace ConfigGenerator {
    /**
     * Config generator for workbenches using IDE platform versions on or after filifjonkan.
     * Uses the iarbuild -jsondb option to find compilation flags for each file, then calls {@link generateFromCompilerArgs}.
     */
    export const generateForFilifjonkan: ConfigGeneratorImpl = async(workbench, project, config, output): Promise<ConfigurationSet> => {
        // Avoid filename collisions between different vs code windows
        const jsonPath = Path.join(tmpdir(), `iar-jsondb${createHash("md5").update(project.path.toString()).digest("hex")}.json`);
        if (await FsUtils.exists(jsonPath)) {
            await fsPromises.rm(jsonPath); // Delete json file to force iarbuild to regenerate it
        }
        // Have iarbuild create the json compilation database
        output.appendLine("Generating compilation database...");
        const extraArgs = Settings.getExtraBuildArguments();
        const builderProc = spawn(workbench.builderPath.toString(), [project.path.toString(), "-jsondb", config.name, "-output", jsonPath].concat(extraArgs));
        builderProc.stdout.on("data", data => output.append(data.toString()));
        builderProc.on("error", (err) => {
            return Promise.reject(err);
        });
        await ProcessUtils.waitForExit(builderProc);

        // Parse the json file for compilation flags
        const json = JSON.parse((await fsPromises.readFile(jsonPath)).toString());
        const compilerInvocations = new Map<string, string[]>();
        for (const fileObj of json) {
            if (fileObj["type"] !== "COMPILER") {
                continue;
            }
            compilerInvocations.set(fileObj["file"], fileObj["arguments"]);
        }
        return generateFromCompilerArgs(compilerInvocations, project, output);
    };

    /**
     * Config generator for workbenches using IDE platform versions prior to filifjonkan.
     * Uses iarbuild -dryrun -log all, parsing the output to find compilation flags for each file, then calls {@link generateFromCompilerArgs}
     */
    export const generateForBeforeFilifjonkan: ConfigGeneratorImpl = async(workbench, project, config, output): Promise<ConfigurationSet> => {
        const extraArgs = Settings.getExtraBuildArguments();
        const builderProc = spawn(workbench.builderPath.toString(), [project.path.toString(), "-dryrun", config.name, "-log", "all"].concat(extraArgs));
        builderProc.on("error", (err) => {
            return Promise.reject(err);
        });
        const exitPromise = ProcessUtils.waitForExit(builderProc);

        // Parse output from iarbuild to find all compiler invocations
        const compInvs = await new Promise<string[][]>((resolve, _reject) => {
            const compilerInvocations: string[][] = [];
            const lineReader = readline.createInterface({
                input: builderProc.stdout,
            });
            lineReader.on("line", (line: string) => {
                if (line.startsWith(">")) { // this is a compiler invocation
                    line = line.slice(1); // get rid of the >
                    const endOfFirstArg = line.search(/\s+/);
                    const args = [line.slice(0, endOfFirstArg)]; // first arg (compiler name) is unquoted, so handle it specially
                    let argsRaw = line.slice(endOfFirstArg).trim();
                    argsRaw = argsRaw.replace(/"\\(\s+)"/g, "\"$1\""); // IarBuild inserts some weird backslashes we want to get rid of
                    const argDelimRegex = /"\s+"/;
                    let match: RegExpExecArray | null;
                    while ((match = argDelimRegex.exec(argsRaw)) !== null) {
                        args.push(stripQuotes(argsRaw.slice(0, match.index)));
                        argsRaw = argsRaw.slice(match.index + 1);
                    }
                    args.push(stripQuotes(argsRaw));
                    compilerInvocations.push(args);
                } else if (line.match(/^Linking/)) { // usually the promise finishes here
                    lineReader.removeAllListeners();
                    resolve(compilerInvocations);
                    return;
                }
                output.appendLine(line);
            });
            lineReader.on("close", () => { // safeguard in case the builder crashes
                output.appendLine("WARN: Builder closed without reaching linking stage.");
                lineReader.removeAllListeners();
                resolve(compilerInvocations);
            });
        }); /* new Promise */
        await exitPromise; // Make sure iarbuild exits without error

        // Find the filename of each compiler invocation, and add to the map
        const compilerInvocationsMap = new Map<string, string[]>();
        compInvs.forEach(compInv => {
            if (compInv?.[0] === undefined || compInv[1] === undefined) return;
            const file = compInv[1];
            if (LanguageUtils.determineLanguage(file) === undefined) {
                output.appendLine("Skipping file of unsupported type: " + file);
                return;
            }
            // generateFromCompilerArgs expects the first arg to be an absolute path to a compiler
            compInv[0] = Path.join(workbench.path.toString(), `${config.toolchainId.toLowerCase()}/bin/${compInv[0]}`);
            compilerInvocationsMap.set(file, compInv);
        });

        return generateFromCompilerArgs(compilerInvocationsMap, project, output);
    };

    /**
     * Generates source configs for a set of files from the arguments used to compile them. This invokes the compiler
     * with some special flags to avoid code generation and output include paths/defines.
     * @param compilerInvocations Maps files in the project to the compiler command line used to compile them
     */
    async function generateFromCompilerArgs(compilerInvocations: Map<string, string[]>, project: Project, output: Vscode.OutputChannel): Promise<ConfigurationSet> {
        output.appendLine("Generating source configuration...");
        const incs: Map<string, IncludePath[]> = new Map();
        const defs: Map<string, Define[]> = new Map();
        const preincs: Map<string, PreIncludePath[]> = new Map();
        const tmpDir = Path.join(tmpdir(), "iar-vsc-source-config");
        if (!await FsUtils.exists(tmpDir)) {
            await fsPromises.mkdir(tmpDir, {recursive: true});
        }

        // A bit obscure, but the promises here are to generate it all in parallel
        const promises: Promise<unknown>[] = [];
        compilerInvocations.forEach((compInv, file) => {
            promises.push((async() => {
                if (compInv?.[0] === undefined) return;
                const compiler = compInv[0];

                // There is no way to differentiate preincludes from regular includes from the compiler output, so parse them from the arguments instead
                // Consume --preinclude arguments, add the rest to adjustedCompInv
                const preincludes: PreIncludePath[] = [];
                const adjustedCompInv: string[] = [];
                while (compInv.length > 0) {
                    const arg = compInv.shift();
                    if (arg === undefined) continue;
                    if (arg === "--preinclude") {
                        const preIncPath = compInv.shift();
                        if (preIncPath === undefined) continue;
                        preincludes.push(new StringPreIncludePath(preIncPath, Path.dirname(project.path.toString())));
                    } else {
                        adjustedCompInv.push(arg);
                    }
                }
                preincs.set(file, preincludes);

                // Run compiler to get the rest
                try {
                    const { includes, defines } = await generateConfigurationForFile(compiler, adjustedCompInv.slice(1), tmpDir, output);
                    incs.set(file, includes);
                    defs.set(file, defines);
                } catch {}

                return Promise.resolve();
            })());
        });

        await Promise.all(promises);
        return Promise.resolve(new ConfigurationSet(incs, defs, preincs));
    }

    /**
     * Generates config data for a single source file
     * by invoking the compiler with specific flags.
     */
    function generateConfigurationForFile(compiler: string, compilerArgs: string[], tmpDir: string, output: Vscode.OutputChannel): Promise<{includes: IncludePath[], defines: Define[]}> {
        if (compilerArgs[0] === undefined) {
            return Promise.reject(new Error("Compiler args should contain at least a filename"));
        }
        // Hash the filename to avoid collisions when running in parallel
        const macrosOutFile = join(tmpDir, createHash("md5").update(compilerArgs[0]).digest("hex") + ".predef_macros");
        const args = ["--IDE3", "--NCG", "--predef-macros", macrosOutFile].concat(compilerArgs);
        const compilerProc = spawn(compiler, args);
        return new Promise((resolve, _reject) => {
            compilerProc.on("error", (err) => {
                output.appendLine("WARN: Compiler gave error: " + err);
            });
            compilerProc.on("exit", code => {
                if (code !== 0) {
                    output.appendLine("WARN: Compiler gave non-zero exit code: " + code);
                }
            });
            const chunks: Buffer[] = [];
            compilerProc.stdout.on("data", (chunk: Buffer) => {
                chunks.push(chunk);
            });
            compilerProc.stdout.on("end", () => {
                const output = Buffer.concat(chunks).toString();
                const includePaths = IncludePath.fromCompilerOutput(output);
                const defines = Define.fromSourceFile(macrosOutFile);
                resolve({
                    includes: includePaths,
                    defines: defines,
                });
            });

        });
    }

    function stripQuotes(str: string): string {
        str = str.trim();
        if (str.startsWith("\"")) {
            str = str.slice(1);
        }
        if (str.endsWith("\"")) {
            str = str.slice(0, -1);
        }
        return str;
    }
}
