/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import { InputModel, selectHandler } from "./model";
import { Handler } from "../../utils/handler";

/**
 * Stores a single object instance and notifies observers when the instance changes
 */
export class SingletonModel<T> implements InputModel<T> {
    private _selected: T | undefined;

    private handlers: Handler<selectHandler<T>>[] = [];

    public selectedText = ""; // TODO: change the interface instead of incorrectly adhering to it

    public addOnSelectedHandler(fn: selectHandler<T>, thisArg?: any): void {
        this.handlers.push(new Handler(fn, thisArg));
    }

    public get selected() {
        return this._selected;
    }

    public set selected(newSelected: T | undefined) {
        this._selected = newSelected;
        this.handlers.forEach(handler => {
            handler.call(this, this._selected);
        });
    }
}