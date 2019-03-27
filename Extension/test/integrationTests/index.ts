/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

var testRunner = require("vscode/lib/testrunner");

testRunner.configure({
    ui: "tdd",
    useColors: true
});

module.exports = testRunner;
