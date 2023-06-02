/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { IntellisenseInfo as IntellisenseInfo } from "./data/intellisenseinfo";
import * as vscode from "vscode";
import * as Path from "path";
import * as fsPromises from "fs/promises";
import * as readline from "readline";
import { spawn } from "child_process";
import { Workbench } from "iar-vsc-common/workbench";
import { Project } from "../../iar/project/project";
import { Config } from "../../iar/project/config";
import { createHash } from "crypto";
import { tmpdir } from "os";
import { FsUtils } from "../../utils/fs";
import { Settings } from "../settings";
import { BackupUtils, LanguageUtils, ListUtils, ProcessUtils } from "../../utils/utils";
import { IncludePath, IncludePathImpl } from "./data/includepath";
import { Define } from "./data/define";
import { PreIncludePath, StringPreIncludePath } from "./data/preincludepath";
import { OsUtils } from "iar-vsc-common/osUtils";
import { Mutex } from "async-mutex";
import { ArgVarsFile } from "../../iar/project/argvarfile";
import { WorkbenchFeatures } from "iar-vsc-common/workbenchfeatureregistry";

/**
 * Generates and holds intellisense information ({@link IntellisenseInfo}) for a collection of projects (a "workspace").
 * The workspace can be queried for intellisense info using {@link getIntellisenseInfoFor}.
 */
export class WorkspaceIntellisenseProvider {
    /**
     * Prepares to provide intellisense info for a set of projects (a "workspace"). The resulting
     * {@link WorkspaceIntellisenseProvider} can then be queried for intellisense info for any file belonging to any of
     * the projects.
     * @param projects The projects to prepare intellisense info for.
     * @param workbench The workbench to use.
     * @param config The preferred project configuration. If a project has a configuration with this name, it is used to
     *  prepare the intellisense info. Otherwise, an arbitrary configuration is used.
     * @param argVarFile The .custom_argvars file used to build the projects.
     * @param workspaceFolder The current VS Code workspace folder.
     * @param outputChannel A channel to log progress to.
     * @returns
     */
    static async loadProjects(
        projects: ReadonlyArray<Project>, workbench: Workbench, config: string, argVarFile?: ArgVarsFile, workspaceFolder?: string, outputChannel?: vscode.OutputChannel
    ): Promise<WorkspaceIntellisenseProvider> {
        try {
            const projectCompDbs: Map<Project, ProjectCompilationDatabase> = new Map();
            await Promise.all(projects.map(async(project) => {
                try {
                    // If the project doesn't have a config the same name as the user's selected one, pick an arbitrary config
                    const actualConfig = project.findConfiguration(config) ?? project.configurations[0];
                    if (actualConfig) {
                        const provider = await ProjectCompilationDatabase.loadFromProject(project, actualConfig, workbench, argVarFile, workspaceFolder, outputChannel);
                        projectCompDbs.set(project, provider);
                    }
                } catch (err) {
                    if (err instanceof Error) {
                        outputChannel?.appendLine(`Intellisense configuration did not complete for '${project.name}': ${err.message}`);
                    }
                }
            }));

            if (projects.length > 0 && projectCompDbs.size === 0) {
                outputChannel?.appendLine("No intellisense configurations were generated");
                throw Error("No intellisense configurations were generated");
            }

            return new WorkspaceIntellisenseProvider(projectCompDbs, workbench, argVarFile, workspaceFolder, outputChannel);
        } catch (err) {
            if (err instanceof Error) {
                outputChannel?.appendLine("Intellisense configuration did not complete: " + err.message);
            }
            throw err;
        }
    }

    private readonly browseInfo: IntellisenseInfo;

    private constructor(
        private readonly projectCompDbs: Map<Project, ProjectCompilationDatabase>,
        private readonly workbench: Workbench,
        private readonly argvarFile?: ArgVarsFile,
        private readonly workspaceFolder?: string,
        private readonly outputChannel?: vscode.OutputChannel,
    ) {
        const sourceDirectories = new Set<string>();
        for (const compDb of projectCompDbs.values()) {
            compDb.projectFiles.forEach(
                sourceFile => sourceDirectories.add(Path.dirname(sourceFile)));
        }
        this.browseInfo = {
            defines: [],
            // VSC-389 Source paths must be included in browse info, or else
            // those files won't be parsed.
            includes: Array.from(sourceDirectories).map(dir => new IncludePathImpl(dir)),
            preincludes: [],
        };
    }

    /**
     * Checks whether the file belongs to any project in this workspace.
     */
    canHandleFile(file: string): boolean {
        for (const compDb of this.projectCompDbs.values()) {
            if (compDb.isFileIncluded(file)) {
                return true;
            }
        }
        return false;
    }

    async getIntellisenseInfoFor(file: string): Promise<IntellisenseInfo> {
        let compDb: ProjectCompilationDatabase | undefined = undefined;
        for (const compDbCandidate of this.projectCompDbs.values()) {
            if (compDbCandidate.isFileIncluded(file)) {
                compDb = compDbCandidate;
                break;
            }
        }
        if (compDb) {
            const [intellisenseInfo, cacheHit] = await compDb.getIntellisenseInfoFor(file);
            // the first time we generate intellisense info for a file, also add it to the browse info
            if (!cacheHit) {
                this.browseInfo.includes = ListUtils.mergeUnique(inc => inc.absolutePath.toString(), intellisenseInfo.includes, this.browseInfo.includes);
                this.browseInfo.defines = ListUtils.mergeUnique(def => def.makeString(), intellisenseInfo.defines, this.browseInfo.defines);
                this.browseInfo.preincludes = ListUtils.mergeUnique(inc => inc.absolutePath.toString(), intellisenseInfo.preincludes, this.browseInfo.preincludes);
            }
            return intellisenseInfo;
        }
        return Promise.reject(new Error("No project in the workspace contains the file"));
    }

    /**
     * Gets the browse info for this workspace, i.e. the intellisense info to use when file-specific info is not
     * available (e.g. for some headers). This is just the union of all file-specific intellisense info we've loaded so far.
     */
    getBrowseInfo(): IntellisenseInfo {
        return this.browseInfo;
    }

    /**
     * Sets the project configuration to use for the given project's intellisense info.
     * @return true if the intellisense info for this project changed
     */
    async setConfigurationForProject(project: Project, config: Config): Promise<boolean> {
        const currentConfig = this.projectCompDbs.get(project);
        if (currentConfig && currentConfig.projectConfig !== config) {
            this.projectCompDbs.set(project,
                await ProjectCompilationDatabase.loadFromProject(project, config, this.workbench, this.argvarFile, this.workspaceFolder, this.outputChannel));
            return true;
        }
        return false;
    }
}

/**
 * Holds information about the files in a project and how they are compiled, and provides
 * intellisense information for files in the project.
 */
class ProjectCompilationDatabase {
    /**
     * Loads a new configuration set for the given project and config, that can then be used to retrieve
     * intellisense configuration for specific files.
     * @param project The project to provide intellisense configuration for
     * @param config The project config (e.g. Debug/Release) to provide intellisense configuration for
     * @param workbench The workbench to use to generate the configuration
     * @param argVarFile A .custom_argvars file to pass to iarbuild
     * @param workspaceFolder The workspace folder the project is in. Used to resolve relative paths
     * @param outputChannel The channel to display output in
     */
    static async loadFromProject(
        project: Project, config: Config, workbench: Workbench, argVarFile?: ArgVarsFile, workspaceFolder?: string, outputChannel?: vscode.OutputChannel
    ): Promise<ProjectCompilationDatabase> {
        try {
            outputChannel?.appendLine(`Preparing intellisense information for '${project.name}'.`);
            let args: Map<string, string[]>;
            if (WorkbenchFeatures.supportsFeature(workbench, WorkbenchFeatures.JsonDb)) { // Filifjonkan
                args = await ConfigGenerator.generateArgsForFilifjonkan(project, config, workbench, argVarFile, workspaceFolder, outputChannel);
            } else {
                args = await ConfigGenerator.generateArgsForBeforeFilifjonkan(project, config, workbench, argVarFile, workspaceFolder, outputChannel);
            }
            outputChannel?.appendLine("Done!");
            return new ProjectCompilationDatabase(config, project, args, outputChannel);
        } catch (err) {
            if (err instanceof Error) {
                outputChannel?.appendLine("Intellisense configuration did not complete: " + err.message);
            }
            throw err;
        }
    }

    private readonly cachedResults: Map<string, IntellisenseInfo> = new Map();

    private constructor(
        public readonly projectConfig: Config,
        private readonly project: Project,
        private readonly compilationArgs: Map<string, string[]>,
        private readonly outputChannel?: vscode.OutputChannel,
    ) {
    }

    /**
     * Checks whether the file is in this project.
     */
    isFileIncluded(file: string): boolean {
        return this.compilationArgs.has(OsUtils.normalizePath(file));
    }

    /**
     * All files in the project
     */
    get projectFiles(): string[] {
        return Array.from(this.compilationArgs.keys());
    }

    /**
     * Gets the intellisense configuration for the given file. The file must be in the project.
     * The results are cached; calling this function repeatedly for the same file is cheap.
     * The second return value indicates whether the configuration had previously been cached.
     */
    async getIntellisenseInfoFor(file: string): Promise<[IntellisenseInfo, boolean]> {
        const cachedConfiguration = this.cachedResults.get(OsUtils.normalizePath(file));
        if (cachedConfiguration) {
            return [cachedConfiguration, true];
        }
        const args = this.compilationArgs.get(OsUtils.normalizePath(file));
        if (!args) {
            return Promise.reject(new Error("File is not in the project"));
        }
        this.outputChannel?.appendLine(`Generating intellisense information for ${file} from project '${this.project.name}'`);
        // note that we clone args! it will be modified, so we can't use the same instance that's in the compilationArgs map
        const config = await ConfigGenerator.generateFromCompilerArgs([...args], this.project, this.outputChannel);

        this.cachedResults.set(OsUtils.normalizePath(file), config);
        return [config, false];
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
    export async function generateArgsForFilifjonkan(
        project: Project, config: Config, workbench: Workbench, argVarFile?: ArgVarsFile, workspaceFolder?: string, output?: vscode.OutputChannel
    ): Promise<Map<string, string[]>> {
        // Avoid filename collisions between different vs code windows
        const jsonPath = Path.join(tmpdir(), `iar-jsondb${createHash("md5").update(project.path.toString()).digest("hex")}.json`);
        let json: Array<{ [key: string]: (string | string[]) }> = [];

        // Make sure multiple instances aren't fighting over the same file
        await mutex.runExclusive(async() => {
            if (await FsUtils.exists(jsonPath)) {
                await fsPromises.rm(jsonPath); // Delete json file to force iarbuild to regenerate it
            }
            // Have iarbuild create the json compilation database
            output?.appendLine("Generating compilation database...");
            let extraArgs = Settings.getExtraBuildArguments();
            if (argVarFile) {
                extraArgs = [...extraArgs, "-varfile", argVarFile.path];
            }

            // VSC-192 Invoke iarbuild and clean up any backups created
            await BackupUtils.doWithBackupCheck(project.path.toString(), async() => {
                const builderProc = spawn(
                    workbench.builderPath.toString(),
                    [project.path.toString(), "-jsondb", config.name, "-output", jsonPath].concat(extraArgs),
                    { cwd: workspaceFolder });
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
            if (typeof (fileObj["file"]) === "string") {
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
    export function generateArgsForBeforeFilifjonkan(
        project: Project, config: Config, workbench: Workbench, argVarFile?: ArgVarsFile, workspaceFolder?: string, output?: vscode.OutputChannel
    ): Promise<Map<string, string[]>> {
        let extraArgs = Settings.getExtraBuildArguments();
        if (argVarFile) {
            extraArgs = [...extraArgs, "-varfile", argVarFile.path];
        }

        // VSC-386 We use a mutex here to throttle the CPU usage
        return mutex.runExclusive(() => {
            // VSC-192 clean up any backups created by iarbuild
            return BackupUtils.doWithBackupCheck(project.path.toString(), async() => {
                const builderProc = spawn(
                    workbench.builderPath.toString(),
                    [project.path.toString(), "-dryrun", config.name, "-log", "all"].concat(extraArgs),
                    { cwd: workspaceFolder },
                );
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
                                const unquotedArg = stripQuotes(argsRaw.slice(0, match.index + 1));
                                // Quotes inside parameters are escaped on the command line, but we want the unescaped parameters
                                const arg = unquotedArg.replace(/\\"/g, "\"");
                                args.push(arg);
                                argsRaw = argsRaw.slice(match.index + 1);
                            }
                            args.push(stripQuotes(argsRaw));
                            compilerInvocations.push(args);
                        } else if (line.match(/^Linking/) || line.match(/^リンク中/)) { // usually the promise finishes here
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
                    compInv[0] = Path.join(workbench.path.toString(), `${config.targetId}/bin/${compInv[0]}`);
                    compilerInvocationsMap.set(OsUtils.normalizePath(file), compInv);
                });

                return compilerInvocationsMap;
            }); /* /doWithBackupCheck */
        }); /* /runExclusive */
    }

    /**
     * Generates source configs for a file from the arguments used to compile it. This invokes the compiler
     * with some special flags to avoid code generation and output include paths/defines.
     * @param compilerArgs The command line used to compile the file
     * @param project The project the file belongs to
     */
    export async function generateFromCompilerArgs(compilerArgs: string[], project: Project, output?: vscode.OutputChannel): Promise<IntellisenseInfo> {
        const tmpDir = Path.join(tmpdir(), "iar-vsc-source-config");
        if (!await FsUtils.exists(tmpDir)) {
            await fsPromises.mkdir(tmpDir, { recursive: true });
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
        } catch { }
        return {
            includes: [],
            defines: [],
            preincludes,
        };
    }

    /**
     * Does the actual compiler invocation for {@link generateFromCompilerArgs}
     */
    function generateConfigurationForFile(
        compiler: string, compilerArgs: string[], tmpDir: string, output?: vscode.OutputChannel
    ): Promise<{ includes: IncludePath[], defines: Define[] }> {
        if (compilerArgs[0] === undefined) {
            return Promise.reject(new Error("Compiler args should contain at least a filename"));
        }
        // Hash the filename to avoid collisions when running in parallel
        const macrosOutFile = Path.join(tmpDir, createHash("md5").update(compilerArgs[0]).digest("hex") + ".predef_macros");
        const args = ["--IDE3", "--NCG", "--predef_macros", macrosOutFile].concat(compilerArgs);
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
