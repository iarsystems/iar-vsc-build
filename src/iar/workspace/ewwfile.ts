/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Path from "path";
import * as Fs from "fs";
import { XmlNode } from "../../utils/XmlNode";
import { EwWorkspace } from "./ewworkspace";
import { logger } from "iar-vsc-common/logger";

export class EwwFile implements EwWorkspace {
    readonly path: string;
    readonly projects: string[];

    constructor(path: string) {
        this.path = path;

        const content = Fs.readFileSync(path);
        const root = new XmlNode(content.toString());

        if (root.tagName !== "workspace") {
            throw new Error(`Expected root tag to be 'workspace', not '${root.tagName}'`);
        }

        const wsDir = Path.dirname(path);

        this.projects = [];
        root.getAllChildsByName("project").forEach(project => {
            const projectPath = project.getAllChildsByName("path")[0]?.text;
            if (!projectPath) {
                logger.warn(`Missing path for project: ${project.text}`);
            } else {
                const expandedPath = projectPath.replace("$WS_DIR$", wsDir);
                this.projects.push(expandedPath);
            }
        });
    }

    get name(): string {
        return Path.basename(this.path, ".eww");
    }

    getArgvarsFile(): string | undefined {
        const argvarsPath = Path.join(
            Path.dirname(this.path),
            Path.basename(this.path, ".eww") + ".custom_argvars"
        );

        if (Fs.existsSync(argvarsPath)) {
            return argvarsPath;
        }
        return undefined;
    }
}