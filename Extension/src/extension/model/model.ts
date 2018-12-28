
'use strict';

type selectHandler<T> = (model: ListInputModel<T>, selected: T) => void;
type invalidateHandler<T> = (model: ListInputModel<T>) => void;

export interface InputModel<T> {
    readonly selected: T | undefined;
    readonly selectedText: string;

    addOnSelectedHandler(fn: selectHandler<T>, thisArg?: any): void;
}

export interface ListInputModel<T> extends InputModel<T> {
    readonly amount: number;

    addOnInvalidateHandler(fn: invalidateHandler<T>, thisArg?: any): void;

    label(index: number): string;
    description(index: number): string | undefined;
    detail(index: number): string | undefined;

    select(index: number): boolean;
}

export abstract class ListInputModelBase<T> implements ListInputModel<T> {
    private selectHandlers: selectHandler<T>[];
    private changeHandlers: invalidateHandler<T>[];

    abstract amount: number;
    abstract selected: T | undefined;
    abstract selectedText: string;

    constructor() {
        this.selectHandlers = [];
        this.changeHandlers = [];
    }

    addOnSelectedHandler(fn: selectHandler<T>, thisArg?: any): void {
        let tmp: any = fn;
        tmp["__this__"] = thisArg;

        this.selectHandlers.push(fn);
    }

    addOnInvalidateHandler(fn: invalidateHandler<T>, thisArg?: any): void {
        let tmp: any = fn;
        tmp["__this__"] = thisArg;

        this.changeHandlers.push(fn);
    }

    protected fireSelectionChanged(item: T): void {
        this.selectHandlers.forEach(fn => {
            let tmp: any = fn;
            fn.apply(tmp["__this__"], [this, item]);
        });
    }

    protected fireInvalidateEvent(): void {
        this.changeHandlers.forEach(fn => {
            let tmp: any = fn;
            fn.apply(tmp["__this__"], [this]);
        });
    }

    abstract label(index: number): string;
    abstract description(index: number): string | undefined;
    abstract detail(index: number): string | undefined;
    abstract select(index: number): boolean;
}
