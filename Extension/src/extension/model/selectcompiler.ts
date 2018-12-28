
'use strict';

import { ListInputModelBase } from "./model";
import { Compiler } from "../../iar/tools/compiler";
import { Workbench } from "../../iar/tools/workbench";

export class CompilerListModel extends ListInputModelBase<Compiler> {
    constructor(...compilers: Compiler[]) {
        super(compilers);
    }

    get selectedText(): string | undefined {
        if (this.selected) {
            return this.selected.name;
        } else {
            return undefined;
        }
    }

    get compilers(): ReadonlyArray<Compiler> {
        return this.data;
    }

    label(index: number): string {
        return this.data[index].name;
    }
    description(index: number): string | undefined {
        return this.data[index].path.toString();
    }
    detail(index: number): string | undefined {
        return this.data[index].path.toString();
    }

    useCompilersFromWorkbench(workbench?: Workbench): void {
        let compilers: Compiler[] = [];

        if (workbench) {
            workbench.platforms.forEach(platform => {
                compilers = compilers.concat(platform.compilers);
            });
        }

        this.data = compilers;
        this.selectedIndex_ = undefined;

        this.fireInvalidateEvent();
        this.fireSelectionChanged();
    }
}
