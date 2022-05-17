/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import { ListInputModelBase } from "./model";
import { Workbench } from "iar-vsc-common/workbench";

export class WorkbenchListModel extends ListInputModelBase<Workbench> {
    constructor(...workbenches: Workbench[]) {
        super(workbenches);
    }

    get workbenches(): ReadonlyArray<Workbench> {
        return this.data;
    }

    label(index: number): string {
        return this.getWorkbenchAt(index).name;
    }
    description(_index: number): string | undefined {
        return undefined;
    }
    detail(index: number): string | undefined {
        return this.getWorkbenchAt(index).path.toString();
    }

    private getWorkbenchAt(index: number): Workbench {
        const result = this.data[index];
        if (result === undefined) {
            throw new Error(`No workbench with index ${index}`);
        }
        return result;
    }
}
