/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import * as Vscode from "vscode";
import * as Fs from "fs";
import * as Path from "path";

import { XmlNode } from "../../../utils/XmlNode";
import { IarXml } from "../../../utils/xml";

export interface PreIncludePath {
    readonly path: Fs.PathLike;
    readonly absolutePath: Fs.PathLike;
    readonly workspaceRelativePath: Fs.PathLike;
}

export class XmlPreIncludePath implements PreIncludePath {
    private xmlData: XmlNode;
    private projectPath: Fs.PathLike;

    constructor(xml: XmlNode, projectPath: Fs.PathLike) {
        this.xmlData = xml;
        this.projectPath = projectPath;

        if (xml.tagName !== "state") {
            throw new Error("Expected an xml element 'state' instead of '" + xml.tagName + "'.");
        }
    }

    get path(): Fs.PathLike {
        let path = this.xmlData.text;

        if (path) {
            return path;
        } else {
            return "";
        }
    }

    get absolutePath(): Fs.PathLike {
        let path = this.path.toString();

        return path.replace('$PROJ_DIR$', this.projectPath.toString());
    }

    get workspaceRelativePath(): Fs.PathLike {
        if (Vscode.workspace.rootPath) {
            let path = this.absolutePath.toString();

            return Path.relative(Vscode.workspace.rootPath, path);
        } else {
            return this.absolutePath;
        }

    }
}

export namespace PreIncludePath {

    export function fromXml(xml: XmlNode, projectPath: Fs.PathLike): PreIncludePath[] {
        let settings = IarXml.findSettingsFromConfig(xml, '/ICC.*/');

        if (settings) {
            let option = IarXml.findOptionFromSettings(settings, 'PreInclude');

            if (option) {
                let states = option.getAllChildsByName('state');
                let preIncludePaths: PreIncludePath[] = [];

                states.forEach(state => {
                    let path = new XmlPreIncludePath(state, projectPath);

                    if (path.path) {
                        preIncludePaths.push(path);
                    }
                });

                return preIncludePaths;
            }
        }

        return [];
    }
}
