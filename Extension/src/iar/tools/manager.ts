
'use strict';

import * as Fs from "fs";
import * as Path from "path";
import { Workbench } from "./workbench";
import { Platform } from "./platform";
import { Compiler } from "./compiler";
import { Handler } from "../../utils/handler";

type invalidateHandler = (manager: ToolManager) => void;

export interface ToolManager {
    readonly workbenches: ReadonlyArray<Workbench>;

    addInvalidateListener(handler: invalidateHandler, thisArg?: any): void;

    add(...workbenches: Workbench[]): void;
    collectFrom(directory: Fs.PathLike): void;

    findWorkbenchContainingPath(path: Fs.PathLike): Workbench | undefined;
    findWorkbenchesContainingCompiler(compiler: Compiler | string): Workbench[] | undefined;
    findWorkbenchesContainingPlatform(platform: Platform | string): Workbench[] | undefined;
}

class IarToolManager implements ToolManager {
    private workbenches_: Workbench[];
    private invalidateHandlers: Handler<invalidateHandler>[] = [];

    constructor() {
        this.workbenches_ = [];
    }

    get workbenches(): ReadonlyArray<Workbench> {
        return this.workbenches_;
    }

    addInvalidateListener(handler: invalidateHandler, thisArg?: any): void {
        this.invalidateHandlers.push(new Handler(handler, thisArg));
    }

    add(...workbenches: Workbench[]): void {
        this.workbenches_ = Workbench.mergeUnique(this.workbenches_, workbenches);

        this.fireInvalidateEvent();
    }

    collectFrom(directory: Fs.PathLike): void {
        let workbench = Workbench.create(directory);

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
            let found = this.findWorkbenchContainingPath(compiler.path);
            if (found) {
                return [found];
            } else {
                return [];
            }
        }

        let workbenches: Workbench[] = [];

        this.workbenches_.forEach((wb) => {
            wb.platforms.forEach((platform) => {
                platform.compilers.forEach((c) => {
                    let parsed = Path.parse(c.path.toString());

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
            let result = this.findWorkbenchContainingPath(platform.path);

            if (result) {
                return [result];
            } else {
                return [];
            }
        }

        let workbench: Workbench[] = [];

        this.workbenches_.forEach((wb) => {
            wb.platforms.forEach((p) => {
                let parsed = Path.parse(p.path.toString());

                if ((parsed.name === platform) || (parsed.base === platform)) {
                    workbench.push(wb);
                }
            });
        });

        return workbench;
    }

    private fireInvalidateEvent() {
        this.invalidateHandlers.forEach(handler => {
            handler.call(this);
        });
    }
}

export namespace ToolManager {
    export function createIarToolManager(): ToolManager {
        return new IarToolManager();
    }
}
