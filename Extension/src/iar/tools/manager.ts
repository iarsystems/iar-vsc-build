/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Fs from "fs";
import { Workbench } from "./workbench";

type InvalidateHandler = (manager: ToolManager) => void;

export interface ToolManager {
    readonly workbenches: ReadonlyArray<Workbench>;

    addInvalidateListener(handler: InvalidateHandler): void;

    add(...workbenches: Workbench[]): void;
    collectFrom(directories: Fs.PathLike[]): void;

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
            this.workbenches_ = Workbench.mergeUnique(this.workbenches_, workbenches);

            this.fireInvalidateEvent();
        }
    }

    collectFrom(directories: Fs.PathLike[]): void {
        let workbenches: Workbench[] = [];
        directories.forEach(directory => {
            const workbench = Workbench.create(directory);

            if (workbench) {
                workbenches.push(workbench);
            } else {
                workbenches = workbenches.concat(Workbench.collectWorkbenchesFrom(directory));
            }
        });
        this.add(...workbenches);
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
}

export namespace ToolManager {
    export function createIarToolManager(): ToolManager {
        return new IarToolManager();
    }
}
