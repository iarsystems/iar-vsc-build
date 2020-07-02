/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import * as Fs from "fs";
import * as Path from "path";
import { LoadedProject } from "../project";
import { XmlNode } from "../../../utils/XmlNode";
import { Config } from "../config";
import { Handler } from "../../../utils/handler";
import { XmlConfig } from "./xmlconfig";

export class EwpFile implements LoadedProject {
    private fileWatcher: Vscode.FileSystemWatcher;
    private xml: XmlNode;
    private configurations_: Config[];

    private onChangedHandlers: Handler<(project: LoadedProject) => void>[] = [];

    readonly path: Fs.PathLike;

    constructor(path: Fs.PathLike) {
        this.path = path;
        this.xml = this.loadXml();
        this.configurations_ = this.loadConfigurations();

        this.fileWatcher = Vscode.workspace.createFileSystemWatcher(this.path.toString());

        this.fileWatcher.onDidChange(() => {
            this.reload();
            this.onChangedHandlers.forEach(handler => handler.call(this));
        });
    }

    get name(): string {
        return Path.parse(this.path.toString()).name;
    }

    get configurations(): ReadonlyArray<Config> {
        return this.configurations_;
    }

    public onChanged(callback: (project: LoadedProject) => void, thisArg?: any): void {
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

    public unload() {
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
        return XmlConfig.fromXml(this.xml);
    }

    private fireChanged() {
        this.onChangedHandlers.forEach(handler => {
            handler.call(this);
        });
    }
}
