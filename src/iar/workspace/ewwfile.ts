/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Path from "path";
import * as Fs from "fs/promises";
import { XmlNode } from "../../utils/XmlNode";
import { EwWorkspace } from "./ewworkspace";
import { logger } from "iar-vsc-common/logger";

export class EwwFile implements EwWorkspace {
    static async load(path: string): Promise<EwwFile> {
        const content = await Fs.readFile(path);
        const root = new XmlNode(content.toString());

        if (root.tagName !== "workspace") {
            throw new Error(`Expected root tag to be 'workspace', not '${root.tagName}'`);
        }

        const wsDir = Path.dirname(path);

        const projects: string[] = [];
        root.getAllChildsByName("project").forEach(project => {
            const projectPath = project.getAllChildsByName("path")[0]?.text;
            if (!projectPath) {
                logger.warn(`Missing path for project: ${project.text}`);
            } else {
                const expandedPath = projectPath.replace("$WS_DIR$", wsDir);
                projects.push(expandedPath);
            }
        });

        return new EwwFile(path, projects);
    }

    private constructor(
        readonly path: string,
        readonly projects: string[],
    ) {}

    get name(): string {
        return Path.basename(this.path, ".eww");
    }
}