
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
