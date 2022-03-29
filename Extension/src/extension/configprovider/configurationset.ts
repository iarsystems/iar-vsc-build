import { PartialSourceFileConfiguration } from "./data/partialsourcefileconfiguration";
import * as vscode from "vscode";
import * as Path from "path";
import * as fsPromises from "fs/promises";
import * as readline from "readline";
import { spawn, spawnSync } from "child_process";
import { Workbench } from "../../iar/tools/workbench";
import { Project } from "../../iar/project/project";
import { Config } from "../../iar/project/config";
import { createHash } from "crypto";
import { tmpdir } from "os";
import { FsUtils } from "../../utils/fs";
import { Settings } from "../settings";
import { BackupUtils, LanguageUtils, ListUtils, ProcessUtils } from "../../utils/utils";
import { IncludePath } from "./data/includepath";
import { Define } from "./data/define";
import { PreIncludePath, StringPreIncludePath } from "./data/preincludepath";
import { OsUtils } from "../../../utils/osUtils";
import { Mutex } from "async-mutex";

/**
 * Provides intellisense configuration (see {@link PartialSourceFileConfiguration}) for a project.
 * This is done lazily; when the project is loaded, the compilation flags for all files are loaded,
 * and when a configuration is requested for a specific file, the compiler is invoked to get the information.
 */
export class ConfigurationSet {

    /**
     * Loads a new configuration set for the given project and config, that can then be used to retrieve
     * intellisense configuration for specific files.
     * @param project The project to provide intellisense configuration for
     * @param config The project config (e.g. Debug/Release) to providue intellisense configuration for
     * @param workbench The workbench to use to generate the configuration
     * @param outputChannel The channel to display output in
     */
    static async loadFromProject(project: Project, config: Config, workbench: Workbench, outputChannel?: vscode.OutputChannel): Promise<ConfigurationSet> {
        // select how to generate configs for this workbench
        const builderOutput = spawnSync(workbench.builderPath.toString()).stdout.toString(); // Spawn without args to get help list
        try {
            let args: Map<string, string[]>;
            if (builderOutput.includes("-jsondb")) { // Filifjonkan
                args = await ConfigGenerator.generateArgsForFilifjonkan(project, config, workbench, outputChannel);
            } else {
                args = await ConfigGenerator.generateArgsForBeforeFilifjonkan(project, config, workbench, outputChannel);
            }
            outputChannel?.appendLine("Done!");
            return new ConfigurationSet(args, project, outputChannel);
        } catch (err) {
            if (err instanceof Error) {
                outputChannel?.appendLine("Source configuration did not complete: " + err.message);
            }
            throw err;
        }
    }

    private browseInfo: PartialSourceFileConfiguration = { includes: [], defines: [], preincludes: [] };

    private constructor(
        private readonly compilationArgs: Map<string, string[]>,
        private readonly project: Project,
        private readonly outputChannel?: vscode.OutputChannel,
    ) { }

    /**
     * Checks whether the file is in this project.
     */
    isFileInProject(file: string): boolean {
        return this.compilationArgs.has(OsUtils.normalizePath(file));
    }

    /**
     * Gets the intellisense configuration for the given file. The file must be in the project.
     */
    async getConfigurationFor(file: string): Promise<PartialSourceFileConfiguration> {
        // It might be a good idea to cache these result, but cpptools does at least *some* caching for us.
        const args = this.compilationArgs.get(OsUtils.normalizePath(file));
        if (!args) {
            return Promise.reject(new Error("File is not in the project"));
        }
        this.outputChannel?.appendLine(`Generating intellisense information for ${file}`);
        // note that we clone args! it will be modified, so we can't use the same instance that's in the compilationArgs map
        const config = await ConfigGenerator.generateFromCompilerArgs([...args], this.project, this.outputChannel);

        this.browseInfo.includes = ListUtils.mergeUnique(inc => inc.absolutePath.toString(), config.includes, this.browseInfo.includes);
        this.browseInfo.defines = ListUtils.mergeUnique(def => def.makeString(), config.defines, this.browseInfo.defines);
        this.browseInfo.preincludes = ListUtils.mergeUnique(inc => inc.absolutePath.toString(), config.preincludes, this.browseInfo.preincludes);
        return config;
    }

    /**
     * Gets the fallback configuration for this project, i.e. the configuration to use when a file-specific ocnfiguration
     * is not available (e.g. for some headers). This is just the sum of all file-specific configurations we've loaded so far.
     * Also used as the "browse configuration" for cpptools' tag parser.
     */
    getFallbackConfiguration(): PartialSourceFileConfiguration {
        return this.browseInfo;
    }
}

/**
 * Actual source config implementations
 */
namespace ConfigGenerator {
    const mutex = new Mutex();

    /**
     * Config generator for workbenches using IDE platform versions on or after filifjonkan.
     * Uses the iarbuild -jsondb option to find compilation flags for each file, then calls {@link generateFromCompilerArgs}.
     */
    export async function generateArgsForFilifjonkan(project: Project, config: Config, workbench: Workbench, output?: vscode.OutputChannel): Promise<Map<string, string[]>> {
        // Avoid filename collisions between different vs code windows
        const jsonPath = Path.join(tmpdir(), `iar-jsondb${createHash("md5").update(project.path.toString()).digest("hex")}.json`);
        let json: Array<{[key: string]: (string | string[])}> = [];

        // Make sure multiple instances aren't fighting over the same file
        await mutex.runExclusive(async() => {
            if (await FsUtils.exists(jsonPath)) {
                await fsPromises.rm(jsonPath); // Delete json file to force iarbuild to regenerate it
            }
            // Have iarbuild create the json compilation database
            output?.appendLine("Generating compilation database...");
            const extraArgs = Settings.getExtraBuildArguments();

            // VSC-192 Invoke iarbuild and clean up any backups created
            await BackupUtils.doWithBackupCheck(project.path.toString(), async() => {
                const builderProc = spawn(workbench.builderPath.toString(), [project.path.toString(), "-jsondb", config.name, "-output", jsonPath].concat(extraArgs));
                builderProc.stdout.on("data", data => output?.append(data.toString()));
                builderProc.on("error", (err) => {
                    return Promise.reject(err);
                });
                await ProcessUtils.waitForExit(builderProc);
            });

            // Parse the json file for compilation flags
            json = JSON.parse((await fsPromises.readFile(jsonPath)).toString());
        });

        const compilerInvocations = new Map<string, string[]>();
        for (const fileObj of json) {
            if (fileObj["type"] !== "COMPILER" || !Array.isArray(fileObj["arguments"])) {
                continue;
            }
            // The compilation db can either contain a single file called "file" or an array of files called "files"
            if (typeof(fileObj["file"]) === "string" ) {
                compilerInvocations.set(OsUtils.normalizePath(fileObj["file"]), fileObj["arguments"]);
            } else if (Array.isArray(fileObj["files"])) {
                for (const file of fileObj["files"]) {
                    compilerInvocations.set(OsUtils.normalizePath(file), fileObj["arguments"]);
                }
            }
        }
        return compilerInvocations;
    }

    /**
     * Config generator for workbenches using IDE platform versions prior to filifjonkan.
     * Uses iarbuild -dryrun -log all, parsing the output to find compilation flags for each file, then calls {@link generateFromCompilerArgs}
     */
    export function generateArgsForBeforeFilifjonkan(project: Project, config: Config, workbench: Workbench, output?: vscode.OutputChannel): Promise<Map<string, string[]>> {
        const extraArgs = Settings.getExtraBuildArguments();

        // VSC-192 clean up any backups created by iarbuild
        return BackupUtils.doWithBackupCheck(project.path.toString(), async() => {
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
                    output?.appendLine(line);
                });
                lineReader.on("close", () => { // safeguard in case the builder crashes
                    output?.appendLine("WARN: Builder closed without reaching linking stage.");
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
                    output?.appendLine("Skipping file of unsupported type: " + file);
                    return;
                }
                // generateFromCompilerArgs expects the first arg to be an absolute path to a compiler
                compInv[0] = Path.join(workbench.path.toString(), `${config.toolchainId.toLowerCase()}/bin/${compInv[0]}`);
                compilerInvocationsMap.set(OsUtils.normalizePath(file), compInv);
            });

            return compilerInvocationsMap;
        }); /* /doWithBackupCheck */
    }

    /**
     * Generates source configs for a file from the arguments used to compile it. This invokes the compiler
     * with some special flags to avoid code generation and output include paths/defines.
     * @param compilerArgs The command line used to compile the file
     * @param project The project the file belongs to
     */
    export async function generateFromCompilerArgs(compilerArgs: string[], project: Project, output?: vscode.OutputChannel): Promise<PartialSourceFileConfiguration> {
        const tmpDir = Path.join(tmpdir(), "iar-vsc-source-config");
        if (!await FsUtils.exists(tmpDir)) {
            await fsPromises.mkdir(tmpDir, {recursive: true});
        }

        if (compilerArgs[0] === undefined) return Promise.reject(new Error());
        const compiler = compilerArgs[0];

        // There is no way to differentiate preincludes from regular includes from the compiler output, so parse them from the arguments instead
        // Consume --preinclude arguments, add the rest to adjustedCompInv
        const preincludes: PreIncludePath[] = [];
        const adjustedCompInv: string[] = [];
        while (compilerArgs.length > 0) {
            const arg = compilerArgs.shift();
            if (arg === undefined) continue;
            if (arg === "--preinclude") {
                const preIncPath = compilerArgs.shift();
                if (preIncPath === undefined) continue;
                preincludes.push(new StringPreIncludePath(preIncPath, Path.dirname(project.path.toString())));
            } else {
                adjustedCompInv.push(arg);
            }
        }

        // Run compiler to get the rest
        try {
            const { includes, defines } = await generateConfigurationForFile(compiler, adjustedCompInv.slice(1), tmpDir, output);
            return {
                includes,
                defines,
                preincludes,
            };
        } catch {}
        return {
            includes: [],
            defines: [],
            preincludes,
        };
    }

    /**
     * Does the actual compiler invocation for {@link generateFromCompilerArgs}
     */
    function generateConfigurationForFile(compiler: string, compilerArgs: string[], tmpDir: string, output?: vscode.OutputChannel): Promise<{includes: IncludePath[], defines: Define[]}> {
        if (compilerArgs[0] === undefined) {
            return Promise.reject(new Error("Compiler args should contain at least a filename"));
        }
        // Hash the filename to avoid collisions when running in parallel
        const macrosOutFile = Path.join(tmpDir, createHash("md5").update(compilerArgs[0]).digest("hex") + ".predef_macros");
        const args = ["--IDE3", "--NCG", "--predef-macros", macrosOutFile].concat(compilerArgs);
        const compilerProc = spawn(compiler, args);
        return new Promise((resolve, _reject) => {
            compilerProc.on("error", (err) => {
                output?.appendLine("WARN: Compiler gave error: " + err);
            });
            compilerProc.on("exit", code => {
                if (code !== 0) {
                    output?.appendLine("WARN: Compiler gave non-zero exit code: " + code);
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
