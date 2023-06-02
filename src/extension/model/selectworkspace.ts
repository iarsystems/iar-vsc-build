/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { EwWorkspace } from "../../iar/workspace/ewworkspace";
import { ListInputModelBase } from "./model";

export class WorkspaceListModel extends ListInputModelBase<EwWorkspace> {
    constructor(...workspaces: EwWorkspace[]) {
        super(workspaces);
    }

    get workspaces(): ReadonlyArray<EwWorkspace> {
        return this.data;
    }

    itemLabel(item: EwWorkspace): string {
        return item.name;
    }
    itemDescription(): string | undefined {
        return undefined;
    }
    itemDetail(item: EwWorkspace): string | undefined {
        return item.path;
    }
}
