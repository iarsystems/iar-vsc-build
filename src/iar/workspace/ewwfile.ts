/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Path from "path";
import * as Fs from "fs";
import { XmlNode } from "../../utils/XmlNode";
import { EwWorkspaceBase } from "./ewworkspace";
import { logger } from "iar-vsc-common/logger";
import { OsUtils } from "iar-vsc-common/osUtils";

export class EwwFile extends EwWorkspaceBase {
    readonly path: string;
    readonly projects: string[];

    constructor(path: string) {
        super();
        this.path = path;

        const content = Fs.readFileSync(path);
        const root = new XmlNode(content.toString());

        if (root.tagName !== "workspace") {
            throw new Error(`Expected root tag to be 'workspace', not '${root.tagName}'`);
        }

        const wsDir = Path.dirname(path);

        this.projects = [];
        root.getAllChildsByName("project").forEach(project => {
            let projectPath = project.getAllChildsByName("path")[0]?.text;
            if (!projectPath) {
                logger.warn(`Missing path for project: ${project.text}`);
            } else {
                // VSC-395 Allow opening workspaces created on windows, on linux
                if (OsUtils.detectOsType() === OsUtils.OsType.Linux) {
                    projectPath = projectPath.replace(/\\/g, "/");
                }
                const expandedPath = projectPath.replace("$WS_DIR$", wsDir);
                this.projects.push(expandedPath);
            }
        });
    }
}