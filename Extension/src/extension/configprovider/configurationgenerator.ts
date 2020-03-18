/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Project } from "../../iar/project/project";
import { Workbench } from "../../iar/tools/workbench";
import { Config } from "../../iar/project/config";
import { ConfigurationCache, SimpleConfigurationCache } from "./configurationcache";
import * as Vscode from "vscode";
import { IncludePath } from "../../iar/project/includepath";
import { Define } from "../../iar/project/define";
import { join } from "path";
import { spawn, spawnSync } from "child_process";
import * as readline from "readline";
import { Readable } from "stream";
import { Compiler } from "../../iar/tools/compiler";
import { tmpdir } from "os";
import * as Path from "path";

/**
 * Generates/detects per-file configuration data (include paths/defines) for an entire project,
 * and caches them (in memory) for later retrieval.
 * This implementation is somewhat slow, but should be completely correct.
 */
export class IarConfigurationGenerator {
    private readonly validExtensions = [".c", ".h", ".cpp", ".hpp", ".cxx", ".hxx", ".cc", ".hh"]; // extensions we can generate configs for

    private runningPromise: Promise<void> | null = null;
    private cache: ConfigurationCache = new SimpleConfigurationCache();
    private output: Vscode.OutputChannel = Vscode.window.createOutputChannel("Iar Config Generator");


    public generateConfiguration(workbench: Workbench, project: Project, compiler: Compiler, config: Config): Promise<void> {
        // make sure we only run once at a time
        // this is probably safe since Node isnt multithreaded
        if (!this.runningPromise) {
            const resetPromise = () => { this.runningPromise = null; };
            this.runningPromise = this.generateConfigurationImpl(workbench, project, compiler, config).then(
                resetPromise,
                (err) => {
                    resetPromise();
                    return Promise.reject(err);
                });
        }
        return this.runningPromise;
    }

    public dispose() {
        this.output.dispose();
    }

    private generateConfigurationImpl(workbench: Workbench, project: Project, compiler: Compiler, config: Config): Promise<void> {
        return new Promise(async (resolve, reject) => {
            // TODO: cross-platformify the path
            const builderPath = join(workbench.path.toString(), "common/bin/IarBuild.exe");
            const builderProc = spawn(builderPath, [project.path.toString(), "-dryrun", config.name, "-log", "all"]);
            builderProc.on("error", (err) => {
                reject(err);
            });
            const compilerInvocations = await this.findCompilerInvocations(builderProc.stdout);

            let hasIncorrectCompiler = false;
            const fileConfigs: Array<{includes: IncludePath[], defines: Define[]}> = [];
            compilerInvocations.forEach(compInv => {
                const extension = Path.extname(compInv[1]);
                if (!this.validExtensions.includes(extension)) {
                    this.output.appendLine("Skipping file of unsupported type: " + compInv[1]);
                    return;
                }
                if (Path.parse(compInv[0]).name !== compiler.name) {
                    this.output.appendLine(`WARN: Compiler name for ${compInv[1]} (${compInv[0]}) does not seem to match the selected compiler.`);
                    hasIncorrectCompiler = true;
                    return;
                }
                fileConfigs.push(this.generateConfigurationForFile(compiler, compInv.slice(1)));
            });
            fileConfigs.forEach((fileConfig, index) => {
                const uri = Vscode.Uri.file(compilerInvocations[index][1]);
                this.putIncludes(uri, fileConfig.includes);
                this.putDefines(uri, fileConfig.defines);
            });
            if (hasIncorrectCompiler) {
                Vscode.window.showWarningMessage("IAR: The selected compiler does not appear to match the one used by the project.");
            }
            resolve();
        });
    }

    public getIncludes(file: Vscode.Uri): IncludePath[] {
        return this.cache.getIncludes(file);
    }
    public getDefines(file: Vscode.Uri): Define[] {
        return this.cache.getDefines(file);
    }

    private putIncludes(file: Vscode.Uri, includes: IncludePath[]) {
        this.cache.putIncludes(file, includes);
    }
    private putDefines(file: Vscode.Uri, defines: Define[]) {
        this.cache.putDefines(file, defines);
    }

    // parses output from builder to find the calls to a compiler (eg iccarm) and what arguments it uses
    private async findCompilerInvocations(builderOutput: Readable): Promise<string[][]> {
        return new Promise((resolve, _reject) => {
            const compilerInvocations: string[][] = [];
            const lineReader = readline.createInterface({
                input: builderOutput,
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
                        args.push(this.stripQuotes(argsRaw.slice(0, match.index)));
                        argsRaw = argsRaw.slice(match.index + 1);
                    }
                    args.push(this.stripQuotes(argsRaw));
                    compilerInvocations.push(args);
                }
                else if (line.match(/^Linking/)) { // usually the promise finishes here
                    lineReader.removeAllListeners();
                    resolve(compilerInvocations);
                    return;
                }
                this.output.appendLine(line);
            });
            lineReader.on("close", () => { // safeguard in case the builder crashes
                this.output.appendLine("WARN: Builder closed without reaching linking stage.");
                lineReader.removeAllListeners();
                resolve(compilerInvocations);
            });
        });
    }

    private stripQuotes(str: string): string {
        str = str.trim();
        if (str.startsWith("\"")) {
            str = str.slice(1);
        }
        if (str.endsWith("\"")) {
            str = str.slice(0, -1);
        }
        return str;
    }

    /**
     * Generates config data for a single translation unit
     * by invoking the compiler with specific flags
     */
    private generateConfigurationForFile(compiler: Compiler, compilerArgs: string[]): {includes: IncludePath[], defines: Define[]} {
        const macrosOutFile = join(tmpdir(), "iarvsc.predef_macros");
        const args = ["--IDE3", "--NCG", "--predef-macros", macrosOutFile].concat(compilerArgs);
        const compilerProc = spawnSync(compiler.path.toString() + "A", args);
        if (compilerProc.error) {
            this.output.appendLine("WARN: Compiler gave error: " + compilerProc.error.message);
            return {includes: [], defines: []};
        }
        if (compilerProc.status && compilerProc.status !== 0) {
            this.output.appendLine("WARN: Compiler gave non-zero exit code: " + compilerProc.status);
            return {includes: [], defines: []};
        }

        const includePaths = IncludePath.fromCompilerOutput(compilerProc.stdout);
        const defines = Define.fromSourceFile(macrosOutFile);
        return {
            includes: includePaths,
            defines: defines,
        };
    }
}