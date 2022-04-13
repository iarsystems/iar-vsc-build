/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Fs from "fs";
import * as Path from "path";
import { FsUtils } from "../../utils/fs";
import { Config } from "./config";
import { Node } from "iar-vsc-common/thrift/bindings/projectmanager_types";

/**
 * An embedded workbench project.
 */
export class Project {
    constructor(public path: Fs.PathLike) {}

    get name(): string {
        return Path.parse(this.path.toString()).name;
    }
}

/**
 * An embedded workbench project that is loaded in some way, so that we can access its configurations.
 */
export interface LoadedProject extends Project {
    configurations: ReadonlyArray<Config>;

    onChanged(callback: (project: LoadedProject) => void): void;
    reload(): void | Promise<void>;
    unload(): void | Promise<void>;
}

/**
 * An embedded workbench project that is loaded through e.g. thrift, so we can perform some operations on it.
 */
export interface ExtendedProject extends LoadedProject {
    /**
     * Gets the node at the top of the project (file) tree.
     */
    getRootNode(): Promise<Node>;
    /**
     * Sets a node in the project (file) tree
     * @param node The new value for the node
     * @param indexPath The path to node to replace, as a series of child indices
     */
    setNode(node: Node, indexPath: number[]): Promise<void>;
    /**
     * Gets the directory where C-STAT will place its output files
     */
    getCStatOutputDirectory(config: string): Promise<string | undefined>;
    /**
     * Gets the C-SPY command line used to debug the configuration
     */
    getCSpyArguments(config: string): Promise<string[] | undefined>;
}


export namespace Project {
    export function findProjectsIn(directory: string, recursive = true): Project[] {
        const projectPaths = FsUtils.walkAndFind(directory, recursive, (path): boolean => {
            const stat = Fs.statSync(path);

            if (stat.isFile()) {
                const extension = Path.parse(path.toString()).ext;

                if (extension === ".ewp" && !Path.basename(path.toString()).startsWith("Backup ")) {
                    return true;
                }
            }

            return false;
        });

        return projectPaths.map(path => new Project(path));
    }
}
