/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import { InputModel, selectHandler } from "./model";
import { Handler } from "../../utils/handler";

/**
 * Stores a single object instance and notifies observers when the instance changes.
 * 
 * The instance can be set using promises, so that it's possible to get
 * a pending value. Doing this will also ensure consistency, so that even if there are multiple
 * promises trying to change the value, the one that was started last will always be the one
 * to actually change the value.
 * Observers are still only notified of _resolved_ values.
 */
export class SingletonModel<T> implements InputModel<T> {
    private _selected: T | undefined;
    private _promise: Promise<T | undefined> | undefined;

    private handlers: Handler<selectHandler<T>>[] = [];

    public readonly selectedText = ""; // TODO: change the interface instead of incorrectly adhering to it

    public addOnSelectedHandler(fn: selectHandler<T>, thisArg?: any): void {
        this.handlers.push(new Handler(fn, thisArg));
    }

    public get selected() {
        return this._selected;
    }

    public set selected(newSelected: T | undefined) {
        this._selected = newSelected;
        this._promise = undefined;
        this.handlers.forEach(handler => {
            handler.call(this, this._selected);
        });
    }

    /**
     * Sets a promise that, when completed, will change the selected value. This lets those requesting the
     * value know that it will change soon, and lets them optionally wait for the new value.
     * Note that a rejected promise will set the selected value to undefined.
     */
    public set selectedPromise(promise: Promise<T | undefined>) {
        this._promise = promise;
        promise.then(result => {
            if (this._promise === promise) {
                this.selected = result;
            }
        }).catch(() => {
            if (this._promise === promise) {
                this.selected = undefined;
            }
        });
    }

    // TODO: needs some testing
    /**
     * Gets the currently selected value as a promise. This is guaranteed to return the latest value,
     * even if it is in the process of changing when the method is called.
     */
    public get selectedPromise(): Promise<T | undefined> {
        const currentPromise = this._promise;
        if (!currentPromise) {
            // Nothing to wait for.
            return Promise.resolve(this.selected);
        } else {
            // If the stored promise has changed while we waited for this one, wait for the new one instead.
            const returnIfPromiseUnchanged = (result: T | undefined) => {
                if (this._promise === currentPromise) {
                    return result;
                } else {
                    return this.selectedPromise;
                }
            }
            return currentPromise.then(res => returnIfPromiseUnchanged(res))
                                    .catch(() => returnIfPromiseUnchanged(undefined));
        }
    }
}