/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import { Handler } from "../../utils/handler";

export type selectHandler<T> = (model: InputModel<T>, selected?: T) => void;
export type invalidateHandler<T> = (model: ListInputModel<T>) => void;

export interface InputModel<T> {
    readonly selected: T | undefined;
    readonly selectedText: string | undefined;

    addOnSelectedHandler(fn: selectHandler<T>, thisArg?: any): void;
}

export interface ListInputModel<T> extends InputModel<T> {
    readonly amount: number;
    readonly selectedIndex: number | undefined;

    addOnInvalidateHandler(fn: invalidateHandler<T>, thisArg?: any): void;

    label(index: number): string;
    description(index: number): string | undefined;
    detail(index: number): string | undefined;

    select(index: number): boolean;

    /** Selects the first item the shouldSelect item returns true for */
    selectWhen(shouldSelect: (item: T) => boolean): boolean;
}

export abstract class ListInputModelBase<T> implements ListInputModel<T> {
    private selectHandlers: Handler<selectHandler<T>>[];
    private changeHandlers: Handler<invalidateHandler<T>>[];

    protected selectedIndex_: number | undefined;
    protected data: ReadonlyArray<T>;

    abstract readonly selectedText: string | undefined;

    constructor(data: T[]) {
        this.selectHandlers = [];
        this.changeHandlers = [];
        this.data = data;

        this.selectedIndex_ = undefined;
    }

    get amount(): number {
        return this.data.length;
    }

    get selectedIndex(): number | undefined {
        return this.selectedIndex_;
    }

    get selected(): T | undefined {
        if (this.selectedIndex !== undefined) {
            return this.data[this.selectedIndex];
        } else {
            return undefined;
        }
    }

    public set(...data: T[]) {
        this.data = data;
        this.selectedIndex_ = undefined;

        this.fireInvalidateEvent();
    }

    select(index: number): boolean {
        if (this.selectedIndex !== index) {
            this.selectedIndex_ = index;
            this.fireSelectionChanged(this.data[this.selectedIndex_]);

            return true;
        } else {
            return false;
        }
    }

    selectWhen(shouldSelect: (item: T) => boolean): boolean {
        return this.data.some((modelItem, index): boolean => {
            if (shouldSelect(modelItem)) {
                this.select(index);
                return true;
            } else {
                return false;
            }
        });
    }

    addOnSelectedHandler(fn: selectHandler<T>, thisArg?: any): void {
        this.selectHandlers.push(new Handler(fn, thisArg));
    }

    addOnInvalidateHandler(fn: invalidateHandler<T>, thisArg?: any): void {
        this.changeHandlers.push(new Handler(fn, thisArg));
    }

    protected fireSelectionChanged(item?: T): void {
        this.selectHandlers.forEach(handler => {
            handler.call(this, item);
        });
    }

    protected fireInvalidateEvent(): void {
        this.changeHandlers.forEach(handler => {
            handler.call(this);
        });
    }

    abstract label(index: number): string;
    abstract description(index: number): string | undefined;
    abstract detail(index: number): string | undefined;
}
