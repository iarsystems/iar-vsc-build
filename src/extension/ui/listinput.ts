/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */


import * as Vscode from "vscode";
import { ListInputModel, InputModel, MutableListInputModelBase } from "../model/model";

type InputItem = Vscode.QuickPickItem & { index: number };

export interface Input<T> {
    readonly model: InputModel<T>;
    show(): boolean;
    selected(): T | undefined;
}

export class ListInput<T> implements Input<T> {
    readonly model: ListInputModel<T>;
    private inputItemWrapper: InputItem[];

    constructor(model: ListInputModel<T>) {
        this.model = model;
        this.inputItemWrapper = [];

        if (MutableListInputModelBase.IsMutable(model)) {
            model.addOnInvalidateHandler(this.generateItemWrappers.bind(this));
        }

        this.generateItemWrappers();
    }

    show(placeholder?: string): boolean {
        let newSelected = false;

        Vscode.window.showQuickPick(this.inputItemWrapper, { placeHolder: placeholder, canPickMany: false }).then(selected => {
            if (selected !== undefined) {
                const idx = selected.index;

                newSelected = this.model.select(idx);
            }
        });

        return newSelected;
    }

    selected(): T | undefined {
        return this.model.selected;
    }

    private generateItemWrappers(): void {
        this.inputItemWrapper = [];

        for (let idx = 0; idx < this.model.amount; idx += 1) {
            const item = {
                label: this.model.label(idx),
                description: this.model.description(idx),
                detail: this.model.detail(idx),
                index: idx
            };

            this.inputItemWrapper.push(item);
        }
    }
}
