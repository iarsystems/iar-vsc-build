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

/**
 * Generates/detects per-file configuration data (include paths/defines) for an entire project.
 * This implementation is somewhat slow, but should be completely correct.
 */
export class IarConfigurationGenerator {
    private runningPromise: Promise<void> | null = null;
    private cache: ConfigurationCache = new SimpleConfigurationCache();
    // TODO: dispose of this sometime?
    private output: Vscode.OutputChannel = Vscode.window.createOutputChannel("Iar Config Generator");


    public generateConfiguration(workbench: Workbench, project: Project, compiler: Compiler, config: Config): Promise<void> {
        // make sure we only run once at a time
        // this is probably safe since Node isnt multithreaded
        if (!this.runningPromise) {
            const resetPromise = () => { this.runningPromise = null; };
            this.runningPromise = this.generateConfigurationImpl(workbench, project, compiler, config).then(resetPromise, resetPromise);
        }
        return this.runningPromise;
    }

    private generateConfigurationImpl(workbench: Workbench, project: Project, compiler: Compiler, config: Config): Promise<void> {
        return new Promise(async (resolve, reject) => {
            // TODO: cross-platformify the path
            const builderPath = join(workbench.path.toString(), "common/bin/IarBuild.exe");
            const builderProc = spawn(builderPath, [project.path.toString(), "-dryrun", config.name, "-log", "all"]);
            const compilerInvocations = await this.findCompilerInvocations(builderProc.stdout);
            const fileConfigs = compilerInvocations.map(compInv => {
                if (compInv[0] !== compiler.name) {
                    // TODO: this fails for projects that include non-c/c++ files (e.g. asm files). Should probably be just a warning.
                    // Probably want to check the file extensions. If it seems to be a c/c++ file, then complain.
                    reject(`Selected compiler does not match compiler used by the project (${compiler.name})`);
                }
                return this.generateConfigurationForFile(compiler, compInv.slice(1));
            });
            fileConfigs.forEach((fileConfig, index) => {
                const uri = Vscode.Uri.file(compilerInvocations[index][1]);
                this.putIncludes(uri, fileConfig.includes);
                this.putDefines(uri, fileConfig.defines);
            });
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

    private async findCompilerInvocations(builderOutput: Readable): Promise<string[][]> {
        // TODO: handle errors
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
                    args.push(argsRaw.trim());
                    compilerInvocations.push(args);
                }
                else if (line.match(/^Linking/)) {
                    lineReader.removeAllListeners("line");
                    resolve(compilerInvocations);
                    return;
                }
                this.output.appendLine(line);
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
        const compilerProc = spawnSync(compiler.path.toString(), args);

        // TODO: handle errors better than by just throwing an error
        const includePaths = IncludePath.fromCompilerOutput(compilerProc.stdout);
        const defines = Define.fromSourceFile(macrosOutFile);
        return {
            includes: includePaths,
            defines: defines,
        };
    }
}