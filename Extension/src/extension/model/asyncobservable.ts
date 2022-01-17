
export type Callback<T> = (value: T) => void;

/**
 * An observable value that is generated/changed using asynchronous operations. This class ensures that
 * observers _always_ see the latest value, and ensures consistency when multiple operations are changing
 * the value concurrently.
 */
export class AsyncObservable<T> {
    private _value: T | undefined;
    private promise: Promise<T | undefined> | undefined;

    private readonly valueChangeHandlers: Callback<T | undefined>[] = [];
    private readonly promiseChangeHandlers: Callback<void>[] = [];
    private promiseResolutions: Callback<T | undefined>[] = [];

    /**
     * Adds a callback to run whenever the observable value changes.
     */
    public onValueDidChange(handler: Callback<T | undefined>): void {
        this.valueChangeHandlers.push(handler);
    }
    /**
     * Adds a callback to run whenever a change operation begins for this value.
     * This indicates that the value will change soon. Useful to e.g display to the user that
     * something is loading.
     */
    public onValueWillChange(handler: Callback<void>): void {
        this.promiseChangeHandlers.push(handler);
    }

    /**
     * Sets the value through a promise; when the promise resolves, its result is used
     * to set this observable's value (if the promise rejects, the value is set to undefined).
     * Observers are notified with {@link onValueWillChange} immediately, and then with
     * {@link onValueDidChange} when the promise fulfills.
     * Not that if this method is called with another promise before the previous one fulfills,
     * the new one will take priority and any previous unfulfilled promises will be ignored.
     */
    public setWithPromise(promise: Promise<T | undefined>) {
        this.promise = promise;
        promise.then(result => {
            if (this.promise === promise) {
                this.setValueAndNotify(result);
            }
        }).catch(() => {
            if (this.promise === promise) {
                this.setValueAndNotify(undefined);
            }
        });
        // TODO: should we call this even if the promise is already resolved?
        this.promiseChangeHandlers.forEach(handler => handler());
    }

    /**
     * Sets the value directly, notifying all observers immediately.
     */
    public setValue(value: T | undefined) {
        this.setWithPromise(Promise.resolve(value));
    }

    /**
     * Gets the current value. If the value is in the process of changing, waits for the new value.
     * Thus, this function always returns the latest value.
     */
    public getValue(): Promise<T | undefined> {
        if (this.promise) {
            return new Promise((resolve, _) => {
                this.promiseResolutions.push(resolve);
            });
        } else {
            return Promise.resolve(this._value);
        }
    }

    private setValueAndNotify(value: T | undefined) {
        this._value = value;
        this.promise = undefined;
        this.valueChangeHandlers.forEach(handler => {
            handler(this._value);
        });
        this.promiseResolutions.forEach(resolve => resolve(value));
        this.promiseResolutions = [];
    }
}