/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Fs from "fs";
import * as Path from "path";
import { Project } from "../project";
import { XmlNode } from "../../../utils/XmlNode";
import { Config } from "../config";
import { XmlConfig } from "./xmlconfig";

/**
 * A parsed ewp file. This is very cheap to instantiate compared to the thrift-based project.
 */
export class EwpFile implements Project {
    private _configurations: Config[];
    private readonly _path: string;
    private readonly onChangeHandlers: (() => void)[] = [];

    constructor(path: string) {
        this._path = path;
        const xml = EwpFile.loadXml(path);
        this._configurations = EwpFile.loadConfigurations(xml);
    }

    get name(): string {
        return Path.parse(this.path.toString()).name;
    }
    get path(): string {
        return this._path;
    }

    get configurations(): ReadonlyArray<Config> {
        return this._configurations;
    }

    public findConfiguration(name: string): Config | undefined {
        return this.configurations.find(config => config.name === name);
    }

    public reload(): void {
        const xml = EwpFile.loadXml(this.path);
        this._configurations = EwpFile.loadConfigurations(xml);
        this.onChangeHandlers.forEach(handler => handler());
    }

    public addOnChangeListener(callback: () => void): void {
        this.onChangeHandlers.push(callback);
    }
    public removeOnChangeListener(callback: () => void): void {
        const idx = this.onChangeHandlers.indexOf(callback);
        if (idx !== -1) {
            this.onChangeHandlers.splice(idx, 1);
        }
    }

    /**
     * Load the xml file. The `path` property should already be initialized!
     *
     * We do not assign the result to `xml` directly because we have to disable
     * the lint check. We have to initialize `xml` in the constructor but we
     * like to create a helper function so we can reuse this code when reloading
     * the project file.
     */
    private static loadXml(path: string): XmlNode {
        const stat = Fs.statSync(path);

        if (!stat.isFile()) {
            throw new Error(`'${path}' is not a file!`);
        }

        const content = Fs.readFileSync(path);

        const node = new XmlNode(content.toString());

        if (node.tagName !== "project") {
            throw new Error("Expected 'project' as root tag");
        }

        return node;
    }

    private static loadConfigurations(xml: XmlNode): Config[] {
        return XmlConfig.fromXml(xml);
    }
}
