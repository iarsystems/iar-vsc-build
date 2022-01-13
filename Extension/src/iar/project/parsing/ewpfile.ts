/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import * as Fs from "fs";
import * as Path from "path";
import { LoadedProject } from "../project";
import { XmlNode } from "../../../utils/XmlNode";
import { Config } from "../config";
import { XmlConfig } from "./xmlconfig";

/**
 * A parsed ewp file. We don't support much functionality here; rather, advanced functionality is added via thrift.
 */
export class EwpFile implements LoadedProject {
    private readonly fileWatcher: Vscode.FileSystemWatcher;
    private xml: XmlNode;
    private _configurations: Config[];

    private readonly onChangedHandlers: ((project: LoadedProject) => void)[] = [];

    readonly path: Fs.PathLike;

    constructor(path: Fs.PathLike) {
        this.path = path;
        this.xml = this.loadXml();
        this._configurations = this.loadConfigurations();

        this.fileWatcher = Vscode.workspace.createFileSystemWatcher(this.path.toString());

        this.fileWatcher.onDidChange(() => {
            this.reload();
            this.onChangedHandlers.forEach(handler => handler(this));
        });
    }

    get name(): string {
        return Path.parse(this.path.toString()).name;
    }

    get configurations(): ReadonlyArray<Config> {
        return this._configurations;
    }

    public onChanged(callback: (project: LoadedProject) => void): void {
        this.onChangedHandlers.push(callback);
    }

    /**
     * Reload the project file.
     */
    public reload(): void {
        try {
            const oldXml = this.xml;
            const oldConfigs = this._configurations;

            try {
                // if loading the xml or configurations fail, restore old state.
                this.xml = this.loadXml();
                this._configurations = this.loadConfigurations();
            } catch (e) {
                this.xml = oldXml;
                this._configurations = oldConfigs;

                throw e;
            }

            this.fireChanged();
        } catch (e) {
            if (typeof e === "string" || e instanceof Error) {
                console.error("Failed to reload project: ", e.toString());
            }
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
        this.fileWatcher.dispose();
    }

    /**
     * Load the xml file. The `path` property should already be initialized!
     *
     * We do not assign the result to `xml` directly because we have to disable
     * the lint check. We have to initialize `xml` in the constructor but we
     * like to create a helper function so we can reuse this code when reloading
     * the project file.
     */
    private loadXml(): XmlNode {
        const stat = Fs.statSync(this.path);

        if (!stat.isFile()) {
            throw new Error("'${this.path.toString()}' is not a file!");
        }

        const content = Fs.readFileSync(this.path);

        const node = new XmlNode(content.toString());

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
            handler(this);
        });
    }
}
