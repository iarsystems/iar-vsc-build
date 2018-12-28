
'use strict';

import * as Fs from "fs";
import * as Path from "path";
import { FsUtils } from "../../utils/fs";
import { ListUtils } from "../../utils/utils";
import { Define } from "../project/define";
import { IncludePath } from "../project/includepath";

export interface Compiler {
    readonly name: string;
    readonly path: Fs.PathLike;
    readonly defines: Define[];
    readonly includePaths: IncludePath[];
}

class IarCompiler implements Compiler {
    readonly path: Fs.PathLike;
    readonly defines: Define[];
    readonly includePaths: IncludePath[];

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

        this.defines = this.computeDefines();
        this.includePaths = this.computeIncludePaths();
    }

    get name(): string {
        return Path.parse(this.path.toString()).name;
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

    protected computeDefines(): Define[] {
        return [];
    }

    protected computeIncludePaths(): IncludePath[] {
        return [];
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