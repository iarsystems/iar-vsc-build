
'use strict';

import * as Fs from "fs";
import * as Path from "path";
import { FsUtils } from "../../utils/fs";
import { ListUtils } from "../../utils/utils";
import { Compiler } from "./compiler";

export interface Platform {
    readonly path: Fs.PathLike;
    readonly compilers: Compiler[];
}

class IarPlatform {
    readonly compilers: Compiler[];
    readonly path: Fs.PathLike;

    /**
     * Create a new Platform object.
     * 
     * @param path The path to the platform root directory, eg: `...\IAR Systems\Workbench\arm`
     */
    constructor(path: Fs.PathLike) {
        this.path = path;

        if (!this.isValidPlatform()) {
            throw new Error("Path does not point to a valid platform directory!");
        }

        let compilerRoot = Path.join(path.toString(), "bin");
        this.compilers = Compiler.collectCompilersFrom(compilerRoot);
    }

    /**
     * Check if the path in the platform object points to a valid path.
     * 
     * @returns {boolean} true if the path points to a valid directory,
     *                    otherwise false.
     */
    private isValidPlatform(): boolean {
        let directoryToCheck = Path.join(this.path.toString(), "bin");
        try {
            let stat = Fs.statSync(directoryToCheck);

            return stat.isDirectory();
        } catch (e) {
            return false;
        }
    }
}

export namespace Platform {
    /**
     * Detect all platforms for a workbench.
     * 
     * @param workbench A workbench for which we have to search platforms
     */
    export function collectPlatformsFrom(root: Fs.PathLike, ignoreFolders: string[]): Platform[] {
        let platforms: Platform[] = [];
        let filter = FsUtils.createFilteredListDirectoryBlacklist(ignoreFolders);

        let platformPaths = FsUtils.filteredListDirectory(root, filter);

        platformPaths.forEach(platformPath => {
            let platform = create(platformPath);

            if (platform !== undefined) {
                platforms.push(platform);
            }
        });

        return platforms;
    }

    /**
     * Merge different lists containing platforms to one list containing
     * unique platforms.
     * @param platforms A list of platform lists
     */
    export function mergeUnique(...platforms: Platform[][]): Platform[] {
        let fnKey = (item: Platform): string => {
            return item.path.toString();
        };

        return ListUtils.mergeUnique(fnKey, ...platforms);
    }

    /**
     * Create a new Platform object. If the given path does not point to a valid
     * platform directory inside an IAR workbench, undefined is returned.
     * 
     * @param path The path of a platfrom in an IAR workbench directory.
     * 
     * @returns {undefined} When the path does not point to a valid path.
     * @returns {Platform} When the object is successfully created.
     */
    function create(path: Fs.PathLike): Platform | undefined {
        try {
            return new IarPlatform(path);
        } catch (e) {
            return undefined;
        }
    }
}
