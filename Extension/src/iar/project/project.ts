/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Fs from "fs";
import * as Path from "path";
import { FsUtils } from "../../utils/fs";
import { Config } from "./config";
import { EwpFile } from "./parsing/ewpfile";

export interface Project {
    readonly path: Fs.PathLike;
    readonly configurations: ReadonlyArray<Config>;
    readonly name: string;

    onChanged(callback: (project: Project) => void, thisArg?: any): void;
    reload(): any;
    unload(): void | Promise<void>;
}


export namespace Project {
    export function createProjectFrom(ewpPath: Fs.PathLike): Project | undefined {
        let stat = Fs.statSync(ewpPath);

        if (!stat.isFile()) {
            return undefined;
        }

        try {
            return new EwpFile(ewpPath);
        } catch (e) {
            return undefined;
        }
    }

    export function createProjectsFrom(directory: Fs.PathLike, recursive: boolean = true): Project[] {
        let projectPaths = findProjectFilesIn(directory, recursive);

        let projects = new Array<Project>();

        projectPaths.forEach(path => {
            let project = createProjectFrom(path);

            if (project) {
                projects.push(project);
            }
        });

        return projects;
    }

    function findProjectFilesIn(directory: Fs.PathLike, recursive: boolean = true): Fs.PathLike[] {
        return FsUtils.walkAndFind(directory, recursive, (path): boolean => {
            let stat = Fs.statSync(path);

            if (stat.isFile()) {
                let extension = Path.parse(path.toString()).ext;

                if (extension === ".ewp") {
                    return true;
                }
            }

            return false;
        });
    }
}
