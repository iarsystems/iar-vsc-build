/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

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

    onChanged(callback: (project: LoadedProject) => void, thisArg?: any): void;
    reload(): any;
    unload(): void | Promise<void>;
}

export interface ExtendedProject extends LoadedProject {
    removeConfiguration(config: Config): Promise<void>;
    addConfiguration(config: Config, isDebug: boolean): Promise<void>;
    getRootNode(): Promise<Node>;
    setNode(node: Node): Promise<void>;
    // TODO: this may have to change in the future to provide a way to get output/results
    build(config: Config): Promise<void>;
}


export namespace Project {
    export function findProjectsIn(directory: Fs.PathLike, recursive: boolean = true): Project[] {
        let projectPaths = FsUtils.walkAndFind(directory, recursive, (path): boolean => {
            let stat = Fs.statSync(path);

            if (stat.isFile()) {
                let extension = Path.parse(path.toString()).ext;

                if (extension === ".ewp" && !Path.basename(path.toString()).startsWith("Backup ")) {
                    return true;
                }
            }

            return false;
        });

        return projectPaths.map(path => new Project(path));
    }
}
