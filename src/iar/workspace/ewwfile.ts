/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Path from "path";
import * as Fs from "fs";
import { OsUtils } from "iar-vsc-common/osUtils";
import * as xmljs from "xml-js";
import { v4 as uuidv4 } from "uuid";
import { logger } from "iar-vsc-common/logger";
import { FsUtils } from "../../utils/fs";
import { XmlNode } from "../../utils/XmlNode";

/**
 * An Embedded Workbench workspace file (.eww). This is unrelated to VS Code's
 * workspace concept.
 */
export class EwwFile {
    readonly name: string;
    readonly path: string;

    constructor(path: string) {
        this.path = path;
        this.name = Path.basename(path, ".eww");
    }
}

export namespace EwwFile {
    export function isWorkspaceFile(filePath: string): boolean {
        return Path.parse(filePath).ext === ".eww";
    }

    /**
     * Parses a .eww file and returns the paths to all projects in it.
     */
    export async function getMemberProjects(filePath: string): Promise<string[]> {
        const content = await Fs.promises.readFile(filePath);
        const root = new XmlNode(content.toString());

        if (root.tagName !== "workspace") {
            throw new Error(`Expected root tag to be 'workspace', not '${root.tagName}'`);
        }

        const wsDir = Path.dirname(filePath);

        const projects: string[] = [];
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
                projects.push(expandedPath);
            }
        });
        return projects;
    }

    /**
     * Gives the path to the .custom_argvars file for the workspace, if one exists.
     */
    export function findArgvarsFileFor(workspace: EwwFile | string): string | undefined {
        const wsPath = typeof workspace === "string" ? workspace : workspace.path;
        const argvarsPath = Path.join(
            Path.dirname(wsPath),
            Path.basename(wsPath, ".eww") + ".custom_argvars"
        );

        if (Fs.existsSync(argvarsPath)) {
            return argvarsPath;
        }
        return undefined;
    }

    /**
     * Creates a temporary .custom_argvars file for the given workspace with the
     * $WS_DIR$ variable populated. This is useful when calling iarbuild to give
     * the impression that the project is built inside the workspace, even
     * though iarbuild doesn't support workspaces.
     */
    export async function generateArgvarsFileFor(workspace: EwwFile | string): Promise<string | undefined> {
        const sourceArgvarsFile = findArgvarsFileFor(workspace);

        let argVarsDocument: xmljs.Element | xmljs.ElementCompact;
        if (sourceArgvarsFile) {
            const contents = Fs.readFileSync(sourceArgvarsFile);
            argVarsDocument = xmljs.xml2js(contents.toString());
        } else {
            argVarsDocument = xmljs.xml2js(`<?xml version="1.0" encoding="UTF-8"?><iarUserArgVars></iarUserArgVars>`);
        }

        const argVarsElem = argVarsDocument.elements?.find((e: xmljs.Element) => e.name === "iarUserArgVars");
        if (!argVarsElem) {
            logger.error(`Malformed .custom_argvars file: ${sourceArgvarsFile}`);
            return undefined;
        }

        const wsPath = typeof workspace === "string" ? workspace : workspace.path;
        const wsDir = Path.dirname(wsPath);

        argVarsElem.elements ??= [];
        argVarsElem.elements.push(xmljs.xml2js(`
        <group name="vscode-iarbuild" active="true">
            <variable>
                <name>WS_DIR</name>
                <value>${wsDir.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</value>
            </variable>
        </group>`).elements[0]);

        const tmpFile = Path.join(await FsUtils.getTmpFolder("iar-build"), uuidv4() + ".custom_argvars");
        await Fs.promises.writeFile(tmpFile, xmljs.js2xml(argVarsDocument));
        return tmpFile;
    }
}
