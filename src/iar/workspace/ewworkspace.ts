/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Path from "path";
import * as Fs from "fs";
import { BatchBuildItem } from "iar-vsc-common/thrift/bindings/projectmanager_types";
import { OsUtils } from "iar-vsc-common/osUtils";
import * as xmljs from "xml-js";
import { v4 as uuidv4 } from "uuid";
import { logger } from "iar-vsc-common/logger";
import { FsUtils } from "../../utils/fs";

/**
 * An Embedded Workbench workspace. This is unrelated to VS Code's workspace concept.
 */
export interface EwWorkspace {
    readonly name: string;
    readonly path: string;
    readonly projects: string[];

    /**
     * Get the list of batches that can be built. Eatch item consits of a name BatchBuildItem with
     * a vector of BuildItems which con
    */
    getBatchBuilds(): Promise<BatchBuildItem[] | undefined>;

    /**
     * Transfer the set of batchbuild items to the backend.
     * @param items The set of batchbuild items to transfer.
     */
    setBatchBuilds(items: BatchBuildItem[]): Promise<void>;
}

export abstract class EwWorkspaceBase implements EwWorkspace {
    abstract readonly path: string;
    abstract readonly projects: string[];

    get name(): string {
        return Path.basename(this.path, ".eww");
    }

    getBatchBuilds(): Promise<BatchBuildItem[] | undefined> {
        return Promise.resolve(undefined);
    }

    setBatchBuilds(_items: BatchBuildItem[]) {
        return Promise.resolve();
    }
}

/**
 * An Embedded Workbench project that is loaded through e.g. thrift, so we can
 * perform some additional operations on it.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ExtendedEwWorkspace extends EwWorkspace {

}

export namespace EwWorkspace {
    export function isWorkspaceFile(filePath: string): boolean {
        return Path.parse(filePath).ext === ".eww";
    }
    /**
     * Gives the path to the .custom_argvars file for the workspace, if one exists.
     */
    export function findArgvarsFileFor(workspace: EwWorkspace | string): string | undefined {
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
    export async function generateArgvarsFileFor(workspace: EwWorkspace | string): Promise<string | undefined> {
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

    export async function equal(ws1: EwWorkspace, ws2: EwWorkspace): Promise<boolean> {
        if (!OsUtils.pathsEqual(ws1.path, ws2.path)) {
            return false;
        }
        for (let i = 0; i < Math.max(ws1.projects.length, ws2.projects.length); i++) {
            const p1 = ws1.projects[i];
            const p2 = ws2.projects[i];
            if (p1 === undefined || p2 === undefined || !OsUtils.pathsEqual(p1, p2)) {
                return false;
            }
        }

        const b1 = await ws1.getBatchBuilds();
        const b2 = await ws2.getBatchBuilds();
        return JSON.stringify(b1) === JSON.stringify(b2);
    }
}
