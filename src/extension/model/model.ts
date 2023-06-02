/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



type SelectHandler<T> = (model: InputModel<T>, selected?: T) => void;
type InvalidateHandler<T> = (model: ListInputModel<T>) => void;

export interface InputModel<T> {
    readonly selected: T | undefined;

    addOnSelectedHandler(fn: SelectHandler<T>): void;
}

export interface ListInputModel<T> extends InputModel<T> {
    readonly amount: number;
    readonly selectedIndex: number | undefined;

    addOnInvalidateHandler(fn: InvalidateHandler<T>): void;

    label(index: number): string;
    description(index: number): string | undefined;
    detail(index: number): string | undefined;

    select(index: number): boolean;

    /** Selects the first item the shouldSelect item returns true for */
    selectWhen(shouldSelect: (item: T) => boolean): boolean;
}

export abstract class ListInputModelBase<T> implements ListInputModel<T> {
    private readonly selectHandlers: SelectHandler<T>[];
    private readonly changeHandlers: InvalidateHandler<T>[];

    protected selectedIndex_: number | undefined;
    protected data: Array<T>;

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
        // If the value wasn't already changed by an invalidate handler, notify that it's been changed
        if (this.selected === undefined) {
            this.fireSelectionChanged(this.selected);
        }
    }

    select(index: number): boolean {
        if (this.selectedIndex !== index && index < this.data.length) {
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

    addOnSelectedHandler(fn: SelectHandler<T>): void {
        this.selectHandlers.push(fn);
    }

    addOnInvalidateHandler(fn: InvalidateHandler<T>): void {
        this.changeHandlers.push(fn);
    }

    protected fireSelectionChanged(item?: T): void {
        this.selectHandlers.forEach(handler => {
            handler(this, item);
        });
    }

    protected fireInvalidateEvent(): void {
        this.changeHandlers.forEach(handler => {
            handler(this);
        });
    }

    label(index: number): string {
        return this.itemLabel(this.getItemAt(index));
    }
    description(index: number): string | undefined {
        return this.itemDescription(this.getItemAt(index));
    }
    detail(index: number): string | undefined {
        return this.itemDetail(this.getItemAt(index));
    }

    protected abstract itemLabel(item: T): string;
    protected abstract itemDescription(item: T): string | undefined;
    protected abstract itemDetail(item: T): string | undefined;

    protected getItemAt(index: number): T {
        const result = this.data[index];
        if (result === undefined) {
            throw new Error(`No item with index ${index}`);
        }
        return result;
    }
}
