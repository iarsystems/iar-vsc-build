/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Os from "os";
import * as Fs from "fs";
import * as Path from "path";
import * as Process from "child_process";
import { FsUtils } from "../../utils/fs";
import { ListUtils } from "../../utils/utils";
import { Define } from "../project/define";
import { IncludePath } from "../project/includepath";
import { Logging } from "../../utils/logging";

export interface Compiler {
    readonly name: string;
    readonly path: Fs.PathLike;
    readonly cDefines: Define[];
    readonly cppDefines: Define[];
    readonly cIncludePaths: IncludePath[];
    readonly cppIncludePaths: IncludePath[];

    prepare(): void;
}

type CompilerOutput = { defines: Define[], includePaths: IncludePath[] };

class IarCompiler implements Compiler {
    readonly path: Fs.PathLike;
    private _cDefines: Define[] | undefined;
    private _cppDefines: Define[] | undefined;
    private _cIncludePaths: IncludePath[] | undefined;
    private _cppIncludePaths: IncludePath[] | undefined;

    /**
     * Create a new Compiler object.
     * 
     * @param path Path to a compiler
     */
    constructor(path: Fs.PathLike) {
        this.path = path;

        if (!this.isValidCompiler()) {
            throw new Error("path does not point to a valid compiler.");
        }

        this._cDefines = undefined;
        this._cIncludePaths = undefined;

        this._cppDefines = undefined;
        this._cppIncludePaths = undefined;
    }

    public prepare(): void {
        if ((this._cDefines === undefined) || (this._cIncludePaths === undefined)) {
            {
                let { defines, includePaths } = this.computeCompilerSpecifics("c");
                this._cDefines = defines;
                this._cIncludePaths = includePaths;
            }

            {
                let { defines, includePaths } = this.computeCompilerSpecifics("cpp");
                this._cppDefines = defines;
                this._cppIncludePaths = includePaths;
            }
        }
    }

    get name(): string {
        return Path.parse(this.path.toString()).name;
    }

    get cDefines(): Define[] {
        if (this._cDefines === undefined) {
            return [];
        } else {
            return this._cDefines;
        }
    }

    get cppDefines(): Define[] {
        if (this._cppDefines === undefined) {
            return [];
        } else {
            return this._cppDefines;
        }
    }

    get cIncludePaths(): IncludePath[] {
        if (this._cIncludePaths === undefined) {
            return [];
        } else {
            return this._cIncludePaths;
        }
    }

    get cppIncludePaths(): IncludePath[] {
        if (this._cppIncludePaths === undefined) {
            return [];
        } else {
            return this._cppIncludePaths;
        }
    }

    /**
     * Check if the path points to a valid compiler.
     */
    protected isValidCompiler(): boolean {
        /* TODO: More advanced check by executing the compiler with some specific flags? */
        try {
            let stat = Fs.statSync(this.path);
            return stat.isFile();
        } catch (e) {
            return false;
        }
    }

    protected computeCompilerSpecifics(language: "c" | "cpp"): CompilerOutput {
        let cmd = this.path.toString();
        let tmpFile = Path.join(Os.tmpdir(), "iarvsc.c");
        let tmpOutFile = Path.join(Os.tmpdir(), "iarvsc.predef_macros");
        let args = ["--IDE3", tmpFile, "--predef_macros", tmpOutFile];

        if (language === "cpp") {
            args.push("--c++")
        }

        try {
            let stat = Fs.statSync(tmpFile);

            if (stat.isDirectory()) {
                Fs.rmdirSync(tmpFile);
            } else if (stat.isFile()) {
                Fs.unlinkSync(tmpFile);
            }
        } catch (e) {
        }

        try {
            let stat = Fs.statSync(tmpOutFile);

            if (stat.isDirectory()) {
                Fs.rmdirSync(tmpOutFile);
            } else if (stat.isFile()) {
                Fs.unlinkSync(tmpOutFile);
            }
        } catch (e) {
        }

        Fs.writeFileSync(tmpFile, "");

        Logging.getInstance().debug("Execute '{0}' '{1}'", cmd, args.join(" "));
        let process = Process.spawnSync(cmd, args, { encoding: "utf8" });

        let defines = this.parseDefinesFrom(tmpOutFile);
        let includePaths = this.parseIncludePathsFrom(process.stdout);

        return { defines: defines, includePaths: includePaths };
    }

    private parseDefinesFrom(filePath: Fs.PathLike): Define[] {
        if (Fs.existsSync(filePath)) {
            return Define.fromSourceFile(filePath);
        } else {
            return [];
        }
    }

    private parseIncludePathsFrom(compilerOutput: string): IncludePath[] {
        return IncludePath.fromCompilerOutput(compilerOutput);
    }
}

export namespace Compiler {
    /**
     * Collect all available compilers for a platform.
     * 
     * @param platform The platform for which we must find compilers.
     */
    export function collectCompilersFrom(root: Fs.PathLike): Compiler[] {
        let compilers: Compiler[] = [];
        let filter = FsUtils.createFilteredListDirectoryFilenameRegex(/icc.*\.exe/);
        let compilerPaths = FsUtils.filteredListDirectory(root, filter);

        compilerPaths.forEach(compilerPath => {
            let compiler = create(compilerPath);

            if (compiler !== undefined) {
                compilers.push(compiler);
            }
        });

        return compilers;
    }

    export function mergeUnique(...lists: Compiler[][]): Compiler[] {
        let fnKey = (item: Compiler): string => {
            return item.path.toString();
        };

        return ListUtils.mergeUnique(fnKey, ...lists);
    }

    /**
     * Create a new Compiler object.
     * 
     * @param path The path to the compiler
     * @returns {undefined} When the path does not point to a valid compiler
     * @returns {Compiler} When the path points to a valid compiler
     */
    function create(path: Fs.PathLike): Compiler | undefined {
        try {
            return new IarCompiler(path);
        } catch (e) {
            return undefined;
        }
    }
}