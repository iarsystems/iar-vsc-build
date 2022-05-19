/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

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