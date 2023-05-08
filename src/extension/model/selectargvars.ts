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

    override itemLabel(item: ArgVarsFile): string {
        return item.name;
    }
    override itemDescription(): string | undefined {
        return undefined;
    }
    override itemDetail(item: ArgVarsFile): string | undefined {
        return item.path;
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
}
