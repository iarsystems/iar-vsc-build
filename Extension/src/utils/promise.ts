/* this source code form is subject to the terms of the mozilla public
 * license, v. 2.0. if a copy of the mpl was not distributed with this
 * file, you can obtain one at https://mozilla.org/mpl/2.0/. */

/**
 * Converts a promise from the Q library to an ES6 promise
 * @param q The Q promise to convert
 */
export async function QtoPromise<T>(q: Q.Promise<T>): Promise<T> {
    return await q;
}
/**
 * Converts a VS Code thenable to an ES6 promise
 * @param then The thenable to convert
 */
export async function ThenableToPromise<T>(then: Thenable<T>): Promise<T> {
    return await then;
}