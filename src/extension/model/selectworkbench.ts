/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import { MutableListInputModelBase } from "./model";
import { Workbench } from "iar-vsc-common/workbench";

export class WorkbenchListModel extends MutableListInputModelBase<Workbench> {
    constructor(...workbenches: Workbench[]) {
        super(workbenches);
    }

    override itemLabel(item: Workbench): string {
        return item.name;
    }
    override itemDescription(): string | undefined {
        return undefined;
    }
    override itemDetail(item: Workbench): string | undefined {
        return item.path;
    }
}
