/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

export class Handler<T extends Function> {
    readonly thisArg: any;
    readonly fn: T;

    constructor(fn: T, thisArg: any) {
        this.thisArg = thisArg;
        this.fn = fn;
    }

    public call(...args: any[]) {
        this.fn.apply(this.thisArg, args);
    }
}
