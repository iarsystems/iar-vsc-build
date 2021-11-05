/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Path from "path";
import * as Fs from "fs";
import { XmlNode } from "../../../utils/XmlNode";
import { IarXml } from "../../../utils/xml";

export interface IncludePath {
    readonly path: Fs.PathLike;
    readonly absolutePath: Fs.PathLike;
}

export class XmlIncludePath implements IncludePath {
    private readonly xmlData: XmlNode;
    private readonly projectPath: Fs.PathLike;

    constructor(xml: XmlNode, projectPath: Fs.PathLike) {
        this.xmlData = xml;
        this.projectPath = projectPath;

        if (xml.tagName !== "state") {
            throw new Error("Expected an xml element 'state' instead of '" + xml.tagName + "'.");
        }
    }

    get path(): Fs.PathLike {
        const path = this.xmlData.text;

        if (path) {
            return path;
        } else {
            return "";
        }
    }

    get absolutePath(): Fs.PathLike {

        const fullPath = this.path.toString().replace("$PROJ_DIR$", this.projectPath.toString());

        return Path.resolve(fullPath);
    }
}

export class StringIncludePath implements IncludePath {
    private readonly includePath: Fs.PathLike;
    private readonly projectPath: Fs.PathLike | undefined;

    constructor(includePath: string, projectPath: string | undefined = undefined) {
        this.includePath = includePath;
        this.projectPath = projectPath;
    }

    get path(): Fs.PathLike {
        return this.includePath;
    }

    get absolutePath(): Fs.PathLike {
        if (this.projectPath === undefined) {
            return Path.resolve(this.includePath.toString());
        } else {
            const fullPath = this.includePath.toString().replace("$PROJ_DIR$", this.projectPath.toString());

            return Path.resolve(fullPath);
        }
    }
}

export namespace IncludePath {
    export function fromXmlData(xml: XmlNode, projectPath: Fs.PathLike): IncludePath[] {
        const settings = IarXml.findSettingsFromConfig(xml, "/ICC.*/");

        if (settings) {
            const option = IarXml.findOptionFromSettings(settings, "/CCIncludePath/");

            if (option) {
                const states = option.getAllChildsByName("state");
                const includePaths: IncludePath[] = [];

                states.forEach(state => {
                    const path = new XmlIncludePath(state, projectPath);

                    if (path.path !== "") {
                        includePaths.push(path);
                    }
                });

                return includePaths;
            }
        }

        return [];
    }

    export function fromCompilerOutput(output: string): IncludePath[] {
        const includes: IncludePath[] = [];

        const regex = /\$\$FILEPATH\s"([^"]*)/g;
        let result: RegExpExecArray | null = null;
        do {
            result = regex.exec(output);

            if (result !== null && (result[1] !== undefined)) {
                const p = result[1].replace(/\\\\/g, "\\");

                try {
                    const stat = Fs.statSync(p);

                    if (stat.isDirectory()) {
                        includes.push(new StringIncludePath(p));
                    }
                } catch (e) {
                }
            }
        } while (result);

        return includes;
    }
}
