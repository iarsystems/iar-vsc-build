
'use strict';

import { ListInputModelBase } from "./model";
import { Workbench } from "../../iar/tools/workbench";

export class WorkbenchListModel extends ListInputModelBase<Workbench> {
    constructor(...workbenches: Workbench[]) {
        super(workbenches);
    }

    get selectedText(): string | undefined {
        if (this.selected) {
            return this.selected.name;
        } else {
            return undefined;
        }
    }

    get workbenches(): Workbench[] {
        return this.data;
    }

    label(index: number): string {
        return this.data[index].name;
    }
    description(index: number): string | undefined {
        return this.data[index].path.toString();
    }
    detail(index: number): string | undefined {
        return this.data[index].idePath.toString();
    }
}
