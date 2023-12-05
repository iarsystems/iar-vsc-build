/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



type SelectHandler<T> = (model: InputModel<T>, selected?: T) => void;
type InvalidateHandler<T> = (model: ListInputModel<T>) => void;

/**
 * An observable selected value (typically some user input).
 */
export interface InputModel<T> {
    readonly selected: T | undefined;

    addOnSelectedHandler(fn: SelectHandler<T>): void;
}

/**
 * A list of selectable values, of which one may be selected.
 * Can be used to drive e.g. a dropdown.
 */
export interface ListInputModel<T> extends InputModel<T> {
    readonly amount: number;
    readonly selectedIndex: number | undefined;

    label(index: number): string;
    description(index: number): string | undefined;
    detail(index: number): string | undefined;

    select(index: number): boolean;

    /** Selects the first item the shouldSelect item returns true for */
    selectWhen(shouldSelect: (item: T) => boolean): boolean;
}

/**
 * A {@link ListInputModel} which allows changing the list of selectable values.
 */
export interface MutableListInputModel<T> extends ListInputModel<T> {
    set(...data: T[]): void;
    addOnInvalidateHandler(fn: InvalidateHandler<T>): void;
}

export abstract class ListInputModelBase<T> implements ListInputModel<T> {
    private readonly selectHandlers: SelectHandler<T>[];

    protected selectedIndex_: number | undefined;
    protected data: Array<T>;

    constructor(data: T[]) {
        this.selectHandlers = [];
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
        fn(this, this.selected);
    }

    protected fireSelectionChanged(item?: T): void {
        this.selectHandlers.forEach(handler => {
            handler(this, item);
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

export abstract class MutableListInputModelBase<T> extends ListInputModelBase<T> implements MutableListInputModel<T> {
    public static IsMutable<T>(model: ListInputModel<T>): model is MutableListInputModel<T> {
        return "set" in model;
    }

    private readonly changeHandlers: InvalidateHandler<T>[];

    constructor(data: T[]) {
        super(data);

        this.changeHandlers = [];
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

    addOnInvalidateHandler(fn: InvalidateHandler<T>): void {
        this.changeHandlers.push(fn);
    }

    private fireInvalidateEvent(): void {
        this.changeHandlers.forEach(handler => {
            handler(this);
        });
    }
}