/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Fs from "fs";
import * as Path from "path";
import { Workbench } from "./workbench";
import { Platform } from "./platform";
import { Compiler } from "./compiler";

type InvalidateHandler = (manager: ToolManager) => void;

export interface ToolManager {
    readonly workbenches: ReadonlyArray<Workbench>;

    addInvalidateListener(handler: InvalidateHandler): void;

    add(...workbenches: Workbench[]): void;
    collectFrom(directory: Fs.PathLike): void;

    findWorkbenchContainingPath(path: Fs.PathLike): Workbench | undefined;
    findWorkbenchesContainingCompiler(compiler: Compiler | string): Workbench[] | undefined;
    findWorkbenchesContainingPlatform(platform: Platform | string): Workbench[] | undefined;
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
            this.workbenches_ = Workbench.mergeUnique(this.workbenches_, workbenches);

            this.fireInvalidateEvent();
        }
    }

    collectFrom(directory: Fs.PathLike): void {
        const workbench = Workbench.create(directory);

        if (workbench) {
            this.add(workbench);
        } else {
            this.add(...Workbench.collectWorkbenchesFrom(directory));
        }
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

    findWorkbenchesContainingCompiler(compiler: Compiler | string): Workbench[] {
        if (typeof compiler !== "string") {
            const found = this.findWorkbenchContainingPath(compiler.path);
            if (found) {
                return [found];
            } else {
                return [];
            }
        }

        const workbenches: Workbench[] = [];

        this.workbenches_.forEach((wb) => {
            wb.platforms.forEach((platform) => {
                platform.compilers.forEach((c) => {
                    const parsed = Path.parse(c.path.toString());

                    if ((parsed.name === compiler) || (parsed.base === compiler)) {
                        workbenches.push(wb);
                    }
                });
            });
        });

        return workbenches;
    }

    findWorkbenchesContainingPlatform(platform: Platform | string): Workbench[] {
        if (typeof platform !== "string") {
            const result = this.findWorkbenchContainingPath(platform.path);

            if (result) {
                return [result];
            } else {
                return [];
            }
        }

        const workbench: Workbench[] = [];

        this.workbenches_.forEach((wb) => {
            wb.platforms.forEach((p) => {
                const parsed = Path.parse(p.path.toString());

                if ((parsed.name === platform) || (parsed.base === platform)) {
                    workbench.push(wb);
                }
            });
        });

        return workbench;
    }

    private fireInvalidateEvent() {
        this.invalidateHandlers.forEach(handler => {
            handler(this);
        });
    }
}

export namespace ToolManager {
    export function createIarToolManager(): ToolManager {
        return new IarToolManager();
    }
}
