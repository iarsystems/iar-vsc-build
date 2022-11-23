/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { ArgVarsFile } from "../../iar/project/argvarfile";
import { ListInputModelBase } from "./model";

export class ArgVarListModel extends ListInputModelBase<ArgVarsFile> {
    constructor(...argVarsFiles: ArgVarsFile[]) {
        super(argVarsFiles);
    }

    get argVarsFiles(): ReadonlyArray<ArgVarsFile> {
        return this.data;
    }

    label(index: number): string {
        return this.getFileAt(index).name;
    }
    description(): string | undefined {
        return undefined;
    }
    detail(index: number): string | undefined {
        return this.getFileAt(index).path;
    }
    addArgVarsFile(argVars: ArgVarsFile) {
        this.data = this.data.concat([argVars]);
        this.fireInvalidateEvent();
    }
    removeArgVarsFile(argVars: ArgVarsFile) {
        const index = this.data.indexOf(argVars);
        if (index !== -1) {
            this.data.splice(index, 1);
            this.fireInvalidateEvent();
        }
    }

    private getFileAt(index: number): ArgVarsFile {
        const result = this.data[index];
        if (result === undefined) {
            throw new Error(`No configuration with index ${index}`);
        }
        return result;
    }
}
