/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Assert from "assert";
import { SingletonModel } from "../../src/extension/model/singletonmodel";

suite("Test SingletonModel", () => {
    test("Synchronous SingletonModel", () => {
        const model = new SingletonModel<string>();
        model.selected = "test";
        Assert.equal(model.selected, "test");
        let called = false;
        model.addOnSelectedHandler((_model, value) => {
            Assert.equal(value, "test2");
            called = true;
        });
        model.selected = "test2";
        Assert(called);
    });

    test("Asynchronous SingletonModel", async () => {
        let model = new SingletonModel<string>();
        model.selectedPromise = makeRejectedPromise();
        Assert.equal(await model.selectedPromise, undefined);
        Assert.equal(model.selected, undefined);
        model.addOnSelectedHandler((_model, value) => Assert.equal(value, "test"));
        model.selectedPromise = makeRejectedPromise();
        model.selectedPromise = Promise.resolve("test");
        Assert.equal(await model.selectedPromise, "test");
        Assert.equal(model.selected, "test");

        model = new SingletonModel<string>();
        model.selectedPromise = Promise.resolve("test");
        model.selectedPromise = Promise.resolve("test2");
        Assert.equal(await model.selectedPromise, "test2");
        Assert.equal(model.selected, "test2");
    });

    function makeRejectedPromise(): Promise<string> {
        return new Promise((_r, e) => {
            setTimeout(e, 50);
        });
    }
});
