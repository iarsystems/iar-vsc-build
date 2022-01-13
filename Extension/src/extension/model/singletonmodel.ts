/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



export type ValueChangeHandler<T> = (value?: T) => void;

/**
 * Stores a single object instance and notifies observers when the instance changes.
 *
 * The instance can be set using promises, so that it's possible to get
 * a pending value. Doing this will also ensure consistency, so that even if there are multiple
 * promises trying to change the value, the one that was started last will always be the one
 * to actually change the value.
 * Observers are still only notified of _resolved_ values.
 */
export class SingletonModel<T> {
    private _value: T | undefined;
    private _promise: Promise<T | undefined> | undefined;

    private readonly handlers: ValueChangeHandler<T>[] = [];

    public addOnValueChangeHandler(fn: ValueChangeHandler<T>): void {
        this.handlers.push(fn);
    }

    public get value() {
        return this._value;
    }

    public set value(newValue: T | undefined) {
        this._value = newValue;
        this._promise = undefined;
        this.handlers.forEach(handler => {
            handler(this._value);
        });
    }

    /**
     * Sets a promise that, when completed, will change the selected value. This lets those requesting the
     * value know that it will change soon, and lets them optionally wait for the new value.
     * Note that a rejected promise will set the selected value to undefined.
     */
    public set valuePromise(promise: Promise<T | undefined>) {
        this._promise = promise;
        promise.then(result => {
            if (this._promise === promise) {
                this.value = result;
            }
        }).catch(() => {
            if (this._promise === promise) {
                this.value = undefined;
            }
        });
    }

    /**
     * Gets the currently selected value as a promise. This is guaranteed to return the latest value,
     * even if it is in the process of changing when the method is called.
     */
    public get valuePromise(): Promise<T | undefined> {
        const currentPromise = this._promise;
        if (!currentPromise) {
            // Nothing to wait for.
            return Promise.resolve(this.value);
        } else {
            // If the stored promise has changed while we waited for this one, wait for the new one instead.
            const returnIfPromiseUnchanged = (result: T | undefined) => {
                if (this._promise === currentPromise) {
                    return result;
                } else {
                    return this.valuePromise;
                }
            };
            return currentPromise.then(res => returnIfPromiseUnchanged(res)).
                catch(() => returnIfPromiseUnchanged(undefined));
        }
    }
}