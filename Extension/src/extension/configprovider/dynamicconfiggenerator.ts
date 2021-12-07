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
import { spawn } from "child_process";
import * as readline from "readline";
import { Readable } from "stream";
import { tmpdir } from "os";
import * as Path from "path";
import { OsUtils, LanguageUtils } from "../../utils/utils";
import { ConfigurationSet } from "./configurationset";

/**
 * Generates/detects per-file configuration data (include paths/defines) for an entire project.
 * This implementation relies on running mock builds of the entire project (iarbuild -dryrun), and analyzing the compiler output.
 */
export class DynamicConfigGenerator {
    private runningPromise: Promise<ConfigurationSet> | null = null;
    private shouldCancel = false;
    private readonly output: Vscode.OutputChannel = Vscode.window.createOutputChannel("Iar Config Generator");


    /**
     * Generates configuration data for an entire project, using the supplied values.
     */
    public generateConfiguration(workbench: Workbench, project: Project, compiler: string, config: Config): Promise<ConfigurationSet> {
        // make sure we only run once at a time
        // this is probably safe since Node isnt multithreaded
        if (!this.runningPromise) {
            this.shouldCancel = false;
            this.runningPromise = this.generateConfigurationImpl(workbench, project, compiler, config).then(
                result => {
                    this.runningPromise = null;
                    return result;
                },
                err => {
                    this.runningPromise = null;
                    return Promise.reject(err);
                });
        }
        return this.runningPromise;
    }

    /**
     * Cancels any ongoing data generation. Any unresolved promises will reject if sucessfully canceled.
     */
    public async cancelCurrentOperation(): Promise<void> {
        if (this.runningPromise) {
            this.shouldCancel = true;
            try {
                await this.runningPromise;
            } catch { } // we don't care if this crashes, since it's canceled and we don't need the result
        }
    }

    public dispose() {
        this.output.dispose();
    }

    private async generateConfigurationImpl(workbench: Workbench, project: Project, compiler: string, config: Config): Promise<ConfigurationSet> {
        let builderPath = join(workbench.path.toString(), "common/bin/iarbuild");
        if (OsUtils.OsType.Windows === OsUtils.detectOsType()) {
            builderPath += ".exe";
        }
        const builderProc = spawn(builderPath, [project.path.toString(), "-dryrun", config.name, "-log", "all"]);
        builderProc.on("error", (err) => {
            this.output.appendLine(err.name + ": " + err.message);
            return Promise.reject(err);
        });

        const compilerInvocations = await this.findCompilerInvocations(builderProc.stdout);

        const incs: Map<string, IncludePath[]> = new Map();
        const defs: Map<string, Define[]> = new Map();

        for (let i = 0; i < compilerInvocations.length; i++) {
            const compInv = compilerInvocations[i];
            if (compInv?.[0] === undefined || compInv[1] === undefined) continue;
            if (LanguageUtils.determineLanguage(compInv[1]) === undefined) {
                this.output.appendLine("Skipping file of unsupported type: " + compInv[1]);
                continue;
            }
            if (Path.parse(compInv[0]).name !== Path.parse(compiler).name) {
                this.output.appendLine(`WARN: Compiler name for ${compInv[1]} (${compInv[0]}) does not seem to match the selected compiler.`);
                continue;
            }
            try {
                const { includes, defines } = await this.generateConfigurationForFile(compiler, compInv.slice(1));
                const path = compInv[1];
                incs.set(path, includes);
                defs.set(path, defines);
            } catch {}

            if (this.shouldCancel) {
                return Promise.reject(new Error("Canceled"));
            }
        }

        return Promise.resolve(new ConfigurationSet(incs, defs));
    }

    // parses output from builder to find the calls to a compiler (eg iccarm) and what arguments it uses
    private findCompilerInvocations(builderOutput: Readable): Promise<string[][]> {
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
                } else if (line.match(/^Linking/)) { // usually the promise finishes here
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
     * by invoking the compiler with specific flags.
     * It is unadvised to run multiple instances of this function at the same time,
     * doing so may cause strange file collisions.  TODO: fix this by using a unique predef_macros file
     */
    private generateConfigurationForFile(compiler: string, compilerArgs: string[]): Promise<{includes: IncludePath[], defines: Define[]}> {
        const macrosOutFile = join(tmpdir(), "iarvsc.predef_macros");
        const args = ["--IDE3", "--NCG", "--predef-macros", macrosOutFile].concat(compilerArgs);
        const compilerProc = spawn(compiler, args);
        return new Promise((resolve, reject) => {
            compilerProc.on("error", (err) => {
                this.output.appendLine("WARN: Compiler gave error: " + err);
                reject(err);
            });
            compilerProc.on("exit", code => {
                if (code !== 0) {
                    this.output.appendLine("WARN: Compiler gave non-zero exit code: " + code);
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
}