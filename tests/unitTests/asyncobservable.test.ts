/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Assert from "assert";
import { AsyncObservable } from "../../src/utils/asyncobservable";

suite("Test AsyncObservable", () => {

    test("Rejected promise gives undefined", async() => {
        const model = new AsyncObservable<string>();
        model.setValue("test");
        model.setWithPromise(makeRejectedPromise());
        Assert.strictEqual(await model.getValue(), undefined);
    });

    test("Async operations override others", async() => {
        const model = new AsyncObservable<string>();
        let didChangeCallCount = 0;
        // This is called immediately with the initial value (i.e. undefined)
        model.onValueDidChange(val => {
            Assert.strictEqual(val, didChangeCallCount === 0 ? undefined : "test2");
            didChangeCallCount += 1;
        });

        model.setWithPromise(makeResolvedPromise("test"));
        model.setWithPromise(makeResolvedPromise("test2"));

        Assert.strictEqual(await model.getValue(), "test2");
        Assert.strictEqual(didChangeCallCount, 2);
    });

    function makeRejectedPromise(): Promise<string> {
        return new Promise((_r, e) => {
            setTimeout(e, 50);
        });
    }

    function makeResolvedPromise(val: string): Promise<string> {
        return new Promise((r, _) => {
            setTimeout(() => r(val), 50);
        });
    }
});
