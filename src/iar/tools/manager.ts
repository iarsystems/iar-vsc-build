/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import { Workbench } from "iar-vsc-common/workbench";
import * as Path from "path";
import { OsUtils } from "iar-vsc-common/osUtils";
import { FsUtils } from "../../utils/fs";
import { ListUtils, ProcessUtils } from "../../utils/utils";
import { logger } from "iar-vsc-common/logger";
import { spawn } from "child_process";
import { tmpdir } from "os";
import { readFile, rm } from "fs/promises";
import { v4 as uuidv4 } from "uuid";

type InvalidateHandler = (manager: ToolManager) => void;

export interface ToolManager {
    readonly workbenches: ReadonlyArray<Workbench>;

    addInvalidateListener(handler: InvalidateHandler): void;

    collectWorkbenches(directories: string[], useRegistry?: boolean): Promise<Workbench[]>;
}

export class IarToolManager implements ToolManager {
    private workbenches_: Workbench[];
    private readonly invalidateHandlers: InvalidateHandler[] = [];

    constructor() {
        this.workbenches_ = [];
    }

    get workbenches(): ReadonlyArray<Workbench> {
        return this.workbenches_;
    }

    addInvalidateListener(handler: InvalidateHandler): void {
        this.invalidateHandlers.push(handler);
    }

    /**
     * Looks for workbenches in the given directories and adds all workbenches found.
     * The found workbenches are also returned.
     * @param useRegistry If true, on windows, also looks in the windows registry for workbenches.
     */
    async collectWorkbenches(directories: string[], useRegistry?: boolean): Promise<Workbench[]> {
        let workbenches: Workbench[] = [];
        await Promise.all(directories.map(async(directory) => {
            const workbench = Workbench.create(directory);

            if (workbench) {
                workbenches.push(workbench);
            } else {
                workbenches = workbenches.concat(await IarToolManager.collectWorkbenchesFrom(directory));
            }
        }));
        if (useRegistry && OsUtils.OsType.Windows === OsUtils.detectOsType()) {
            try {
                workbenches = workbenches.concat(await IarToolManager.collectFromWindowsRegistry());
            } catch (e) {
                logger.error("Failed to fetch toolchains from registry: " + e);
            }
        }

        logger.debug(`Collected ${workbenches.length} toolchains`);
        this.add(...workbenches);
        return workbenches;
    }

    private add(...workbenches: Workbench[]): void {
        if (workbenches.length > 0) {
            const prevLength = this.workbenches.length;
            this.workbenches_ = IarToolManager.mergeUnique(this.workbenches_, workbenches);

            if (this.workbenches_.length !== prevLength) {
                this.workbenches_.sort((a, b) => a.name.toString().localeCompare(b.name.toString()));
                this.fireInvalidateEvent();
            }
            logger.debug(`${this.workbenches_.length - prevLength} new toolchain(s) added`);
        }
    }

    private fireInvalidateEvent() {
        this.invalidateHandlers.forEach(handler => {
            handler(this);
        });
    }

    /**
     * Search for valid workbenches. The found workbenches are stored in the
     * Workbench class and are accessible using the static accessor functions.
     *
     * @param root The root folder where we must search for valid workbench
     *             paths. By default this is `C:\Program Files (x86)\IAR Systems`.
     *
     * @returns {Workbench[]} A list of found workbenches. Size can be 0.
     */
    private static async collectWorkbenchesFrom(root: string): Promise<Workbench[]> {
        const workbenches = new Array<Workbench>();

        const directories = await FsUtils.filteredListDirectory(root, () => true);

        directories.forEach(directory => {
            const workbench = Workbench.create(directory);

            if (workbench !== undefined) {
                workbenches.push(workbench);
            }
        });

        return workbenches;
    }

    private static async collectFromWindowsRegistry(): Promise<Workbench[]> {
        const keys = [
            "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
            "HKEY_LOCAL_MACHINE\\SOFTWARE\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
        ];
        const paths: Array<Array<string | undefined>> = await Promise.all(keys.map(async key => {
            const entries = await RegisterUtils.getAllEntries(key);
            return entries.map(entry => {
                if (entry["Publisher"] !== "IAR Systems") {
                    return undefined;
                }
                const displayName = entry["DisplayName"];
                if (displayName === undefined || !(displayName.includes("Embedded Workbench") || displayName.includes("Build Tools"))) {
                    return undefined;
                }
                return entry["InstallLocation"];
            });
        }));

        const workbenches: Workbench[] = [];
        paths.flat().forEach(path => {
            if (path !== undefined) {
                const wb = Workbench.create(path);
                if (wb !== undefined) {
                    workbenches.push(wb);
                }
            }
        });
        return workbenches;
    }

    /**
     * Merge two or more lists containing workbenches. This function will return
     * a list of unique workbenches. Duplicates are removed.
     *
     * @param lists Array of list containing lists of workbenches
     */
    private static mergeUnique(...lists: Array<Workbench>[]): Workbench[] {
        const fnKey = (item: Workbench): string => {
            return OsUtils.normalizePath(item.path.toString());
        };

        return ListUtils.mergeUnique(fnKey, ...lists);
    }


}

namespace RegisterUtils {

    export async function getAllEntries(key: string): Promise<Record<string, string>[]> {
        const exePath = process.env["windir"] ? Path.join(process.env["windir"], "system32", "reg.exe") : "reg.exe";
        const resultPath = Path.join(tmpdir(), "iar-build", uuidv4() + "-winreg.txt");
        const proc = spawn(exePath, ["export", key, resultPath, "/y"]);
        proc.stdout.on("data", dat => console.log(dat.toString()));
        proc.stderr.on("data", dat => console.error(dat.toString()));
        await ProcessUtils.waitForExit(proc);

        const contents = (await readFile(resultPath)).toString("utf16le");
        await rm (resultPath);

        const results: Record<string, string>[] = [];
        const lines = contents.split("\r\n");
        const keyRegex = new RegExp(`\\[${key.replace(/\\/g, "\\\\")}\\\\[\\w\\-{}]+\\]`);
        const valueRegex = /"([^"]+)"="([^"]+)"/;
        let curr: Record<string, string> = {};
        lines.forEach(line => {
            if (keyRegex.test(line)) {
                results.push(curr);
                curr = {};
            }
            const match = line.match(valueRegex);
            if (match && match[1] && match[2]) {
                curr[match[1]] = match[2];
            }
        });
        results.push(curr);
        return results;
    }
}
