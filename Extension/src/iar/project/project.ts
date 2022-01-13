/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Fs from "fs";
import * as Path from "path";
import { FsUtils } from "../../utils/fs";
import { Config } from "./config";
import { Node } from "./thrift/bindings/projectmanager_types";

export class Project {
    constructor(public path: Fs.PathLike) {}

    get name(): string {
        return Path.parse(this.path.toString()).name;
    }
}

export interface LoadedProject extends Project {
    readonly configurations: ReadonlyArray<Config>;

    onChanged(callback: (project: LoadedProject) => void): void;
    reload(): void | Promise<void>;
    unload(): void | Promise<void>;
}

export interface ExtendedProject extends LoadedProject {
    removeConfiguration(config: Config): Promise<void>;
    addConfiguration(config: Config, isDebug: boolean): Promise<void>;
    getRootNode(): Promise<Node>;
    setNode(node: Node): Promise<void>;
}


export namespace Project {
    export function findProjectsIn(directory: Fs.PathLike, recursive = true): Project[] {
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
