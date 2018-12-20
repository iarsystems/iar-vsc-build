
'use strict';

import * as Fs from "fs";
import { FsUtils } from "../../utils/fs";
import { ListUtils } from "../../utils/utils";

export interface Compiler {
    readonly path: Fs.PathLike;
}

class IarCompiler {
    readonly path: Fs.PathLike;

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
}

export namespace Compiler {
    /**
     * Create a new Compiler object.
     * 
     * @param path The path to the compiler
     * @returns {undefined} When the path does not point to a valid compiler
     * @returns {Compiler} When the path points to a valid compiler
     */
    export function create(path: Fs.PathLike): Compiler | undefined {
        try {
            return new IarCompiler(path);
        } catch (e) {
            return undefined;
        }
    }

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
        }

        return ListUtils.mergeUnique(fnKey, ...lists);
    }
}