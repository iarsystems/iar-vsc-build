/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Fs from "fs";
import * as Path from "path";
import { FsUtils } from "../../utils/fs";
import { ListUtils, OsUtils } from "../../utils/utils";

export interface Compiler {
    readonly name: string;
    readonly path: Fs.PathLike;
}

class IarCompiler implements Compiler {
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

    get name(): string {
        return Path.parse(this.path.toString()).name;
    }

    /**
     * Check if the path points to a valid compiler.
     */
    protected isValidCompiler(): boolean {
        /* TODO: More advanced check by executing the compiler with some specific flags? */
        try {
            const stat = Fs.statSync(this.path);
            return stat.isFile();
        } catch (e) {
            return false;
        }
    }
}

export namespace Compiler {
    /**
     * Collect all available compilers for a platform.
     *
     * @param platform The platform for which we must find compilers.
     */
    export function collectCompilersFrom(root: Fs.PathLike): Compiler[] {
        const compilers: Compiler[] = [];
        let regex = "icc.*";
        if (OsUtils.detectOsType() === OsUtils.OsType.Windows) {
            regex += "\\.exe";
        }
        const filter = FsUtils.createFilteredListDirectoryFilenameRegex(new RegExp(regex));
        const compilerPaths = FsUtils.filteredListDirectory(root, filter);

        compilerPaths.forEach(compilerPath => {
            const compiler = create(compilerPath);

            if (compiler !== undefined) {
                compilers.push(compiler);
            }
        });

        return compilers;
    }

    export function mergeUnique(...lists: Compiler[][]): Compiler[] {
        const fnKey = (item: Compiler): string => {
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