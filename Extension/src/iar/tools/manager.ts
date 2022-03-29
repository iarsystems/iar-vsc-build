/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Fs from "fs";
import { Workbench } from "./workbench";
import * as Registry from "winreg";
import { OsUtils } from "../../../utils/osUtils";

type InvalidateHandler = (manager: ToolManager) => void;

export interface ToolManager {
    readonly workbenches: ReadonlyArray<Workbench>;

    addInvalidateListener(handler: InvalidateHandler): void;

    add(...workbenches: Workbench[]): void;
    collectWorkbenches(directories: Fs.PathLike[], useRegistry?: boolean): Promise<Workbench[]>;

    findWorkbenchContainingPath(path: Fs.PathLike): Workbench | undefined;
}

class IarToolManager implements ToolManager {
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

    add(...workbenches: Workbench[]): void {
        if (workbenches.length > 0) {
            const prevLength = this.workbenches.length;
            this.workbenches_ = Workbench.mergeUnique(this.workbenches_, workbenches);

            if (this.workbenches_.length !== prevLength) {
                this.workbenches_.sort((a, b) => a.name.toString().localeCompare(b.name.toString()));
                this.fireInvalidateEvent();
            }
        }
    }

    /**
     * Looks for workbenches in the given directories and adds all workbenches found.
     * The found workbenches are also returned.
     * @param useRegistry If true, on windows, also looks in the windows registry for workbenches.
     */
    async collectWorkbenches(directories: string[], useRegistry?: boolean): Promise<Workbench[]> {
        let workbenches: Workbench[] = [];
        directories.forEach(directory => {
            const workbench = Workbench.create(directory);

            if (workbench) {
                workbenches.push(workbench);
            } else {
                workbenches = workbenches.concat(Workbench.collectWorkbenchesFrom(directory));
            }
        });
        if (useRegistry && OsUtils.OsType.Windows === OsUtils.detectOsType()) {
            try {
                workbenches = workbenches.concat(await IarToolManager.collectFromWindowsRegistry());
            } catch (e) {
                console.log("Failed to fetch workbenches from registry: ", e);
            }
        }

        this.add(...workbenches);
        return workbenches;
    }

    findWorkbenchContainingPath(path: Fs.PathLike): Workbench | undefined {
        let workbench: Workbench | undefined = undefined;

        this.workbenches_.some((value): boolean => {
            if (path.toString().startsWith(value.path.toString())) {
                workbench = value;
            }

            return workbench !== undefined;
        });

        return workbench;
    }

    private fireInvalidateEvent() {
        this.invalidateHandlers.forEach(handler => {
            handler(this);
        });
    }

    private static async collectFromWindowsRegistry(): Promise<Workbench[]> {
        const keys = [
            "\\SOFTWARE\\IAR Systems\\Embedded Workbench\\5.0\\Locations",
            "\\SOFTWARE\\Wow6432Node\\IAR Systems\\Embedded Workbench\\5.0\\Locations",
        ];
        const paths: string[][] = await Promise.all(keys.map(key => {
            return new Promise<string[]>((resolve, reject) => {
                const regKey = new Registry({
                    hive: Registry.HKLM,
                    key: key,
                });
                regKey.keys((err, locationKeys) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    const found: string[] = [];
                    locationKeys.forEach(locationKey => {
                        locationKey.get("InstallPath", (err, value) => {
                            if (err) {
                                console.error(err);
                                found.push("");
                            } else {
                                found.push(value.value);
                            }
                            if (found.length === locationKeys.length) {
                                resolve(found);
                            }
                        });
                    });
                });
            });
        }));
        const workbenches: Workbench[] = [];
        paths.flat().forEach(path => {
            const wb = Workbench.create(path);
            if (wb !== undefined) {
                workbenches.push(wb);
            }
        });
        return workbenches;
    }
}

export namespace ToolManager {
    export function createIarToolManager(): ToolManager {
        return new IarToolManager();
    }
}
