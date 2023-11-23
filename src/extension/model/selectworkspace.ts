/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { EwwFile } from "../../iar/workspace/ewwfile";
import { MutableListInputModelBase } from "./model";

export class WorkspaceListModel extends MutableListInputModelBase<EwwFile> {
    constructor(...workspaces: EwwFile[]) {
        super(workspaces);
    }

    get workspaces(): ReadonlyArray<EwwFile> {
        return this.data;
    }

    itemLabel(item: EwwFile): string {
        return item.name;
    }
    itemDescription(): string | undefined {
        return undefined;
    }
    itemDetail(item: EwwFile): string | undefined {
        return item.path;
    }
}
