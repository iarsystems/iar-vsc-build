
'use strict';

import { ListInputModelBase } from "./model";
import { Workbench } from "../../iar/tools/workbench";

export class WorkbenchListModel extends ListInputModelBase<Workbench> {
    private workbenches_: Workbench[];

    selected: Workbench | undefined;

    constructor(...workbenches: Workbench[]) {
        super();

        this.workbenches_ = workbenches;
    }

    public setWorkbenches(...workbenches: Workbench[]) {
        this.workbenches_ = workbenches;

        this.fireInvalidateEvent();
    }

    get amount(): number {
        return this.workbenches_.length;
    }

    get selectedText(): string | undefined {
        if (this.selected) {
            return this.selected.name;
        } else {
            return undefined;
        }
    }

    get workbenches(): Workbench[] {
        return this.workbenches_;
    }

    label(index: number): string {
        return this.workbenches_[index].name;
    }
    description(index: number): string | undefined {
        return this.workbenches_[index].path.toString();
    }
    detail(index: number): string | undefined {
        return this.workbenches_[index].idePath.toString();
    }

    select(index: number): boolean {
        let tmp = this.workbenches[index];

        if (!this.selected) {
            this.selected = tmp;
            this.fireSelectionChanged(this.selected);

            return true;
        } else if (this.selected.idePath !== tmp.idePath) {
            this.selected = tmp;
            this.fireSelectionChanged(this.selected);

            return true;
        } else {
            return false;
        }
    }
}
