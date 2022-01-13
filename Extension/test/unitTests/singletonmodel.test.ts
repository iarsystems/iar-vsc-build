/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Assert from "assert";
import { SingletonModel } from "../../src/extension/model/singletonmodel";

suite("Test SingletonModel", () => {
    test("Synchronous SingletonModel", () => {
        const model = new SingletonModel<string>();
        model.value = "test";
        Assert.equal(model.value, "test");
        let called = false;
        model.addOnValueChangeHandler(value => {
            Assert.equal(value, "test2");
            called = true;
        });
        model.value = "test2";
        Assert(called);
    });

    test("Asynchronous SingletonModel", async() => {
        let model = new SingletonModel<string>();
        model.valuePromise = makeRejectedPromise();
        Assert.equal(await model.valuePromise, undefined);
        Assert.equal(model.value, undefined);
        model.addOnValueChangeHandler(value => Assert.equal(value, "test"));
        model.valuePromise = makeRejectedPromise();
        model.valuePromise = Promise.resolve("test");
        Assert.equal(await model.valuePromise, "test");
        Assert.equal(model.value, "test");

        model = new SingletonModel<string>();
        model.valuePromise = Promise.resolve("test");
        model.valuePromise = Promise.resolve("test2");
        Assert.equal(await model.valuePromise, "test2");
        Assert.equal(model.value, "test2");
    });

    function makeRejectedPromise(): Promise<string> {
        return new Promise((_r, e) => {
            setTimeout(e, 50);
        });
    }
});
