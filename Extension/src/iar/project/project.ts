/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import * as Fs from "fs";
import * as Path from "path";
import { Config } from "./config";
import { XmlNode } from "../../utils/XmlNode";
import { FsUtils } from "../../utils/fs";
import { Handler } from "../../utils/handler";

export interface Project {
    readonly path: Fs.PathLike;
    readonly configurations: ReadonlyArray<Config>;
    readonly name: string;

    onChanged(callback: (project: Project) => void, thisArg?: any): void;
    reload(): any;
    findConfiguration(name: string): Config | undefined;
}

class EwpFile implements Project {
    private fileWatcher: Vscode.FileSystemWatcher;
    private xml: XmlNode;
    private configurations_: Config[];

    private onChangedHandlers: Handler<(project: Project) => void>[] = [];

    readonly path: Fs.PathLike;

    constructor(path: Fs.PathLike) {
        this.path = path;
        this.xml = this.loadXml();
        this.configurations_ = this.loadConfigurations();

        this.fileWatcher = Vscode.workspace.createFileSystemWatcher(this.path.toString());

        this.fileWatcher.onDidChange(() => {
            this.reload(); //TODO: add an event here?
        });
    }

    get name(): string {
        return Path.parse(this.path.toString()).name;
    }

    get configurations(): ReadonlyArray<Config> {
        return this.configurations_;
    }

    public onChanged(callback: (project: Project) => void, thisArg?: any): void {
        this.onChangedHandlers.push(new Handler(callback, thisArg));
    }

    /**
     * Reload the project file.
     * 
     * \returns {undefined} On success.
     * \returns {any} When an error occured.
     */
    public reload(): any {
        try {
            let oldXml = this.xml;
            let oldConfigs = this.configurations_;

            try {
                // if loading the xml or configurations fail, restore old state.
                this.xml = this.loadXml();
                this.configurations_ = this.loadConfigurations();
            } catch (e) {
                this.xml = oldXml;
                this.configurations_ = oldConfigs;

                throw e;
            }

            this.fireChanged();

            return undefined;
        } catch (e) {
            return e;
        }
    }

    public findConfiguration(name: string): Config | undefined {
        let result: Config | undefined = undefined;

        this.configurations.some((config): boolean => {
            if (config.name === name) {
                result = config;
                return true;
            }

            return false;
        });

        return result;
    }

    /**
     * Load the xml file. The `path` property should already be initialized!
     * 
     * We do not assing the result to `xml` directly because we have to disable
     * the lint check. We have to initialize `xml` in the constructor but we
     * like to create a helper function so we can reuse this code when reloading
     * the project file.
     */
    private loadXml(): XmlNode {
        let stat = Fs.statSync(this.path);

        if (!stat.isFile()) {
            throw new Error("'${this.path.toString()}' is not a file!");
        }

        let content = Fs.readFileSync(this.path);

        let node = new XmlNode(content.toString());

        if (node.tagName !== "project") {
            throw new Error("Expected 'project' as root tag");
        }

        return node;
    }

    private loadConfigurations(): Config[] {
        return Config.fromXml(this.xml);
    }

    private fireChanged() {
        this.onChangedHandlers.forEach(handler => {
            handler.call(this);
        });
    }
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
