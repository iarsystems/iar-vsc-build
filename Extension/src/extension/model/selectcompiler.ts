/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import { ListInputModelBase } from "./model";
import { Compiler } from "../../iar/tools/compiler";
import { Workbench } from "../../iar/tools/workbench";
import { Settings } from "../settings";

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

        // If there is already a selected compiler, we want to try to use the same one from the new workbench
        if (this.selected) {
            const i = compilers.findIndex(comp => {
                if (!this.selected) return false;
                return comp.name === this.selected.name
            });
            if (i >= 0) {
                this.selectedIndex_ = i;
            } else {
                // If there's no matching compiler, we clear the setting so that it doesn't point to a compiler in the old workbench
                Settings.setCompiler("");
                this.selectedIndex_ = undefined;
            }
        } else {
            this.selectedIndex_ = undefined;
        }
        this.data = compilers;

        this.fireInvalidateEvent();
        this.fireSelectionChanged();
    }
}
