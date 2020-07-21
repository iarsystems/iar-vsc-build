/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Mocha from 'mocha';
import * as path from 'path';
import * as fs from 'fs';

export function run(): Promise<void> {
    const mocha = new Mocha({
        ui: 'tdd',
    });
    mocha.useColors(true);

    const testsRoot = path.resolve(__dirname);

    return new Promise((c, e) => {
        // run all test files in this directory
        fs.readdir(testsRoot, (err, files) => {
            if (err) { return e(err); }
            files = files.filter(file => file.endsWith(".test.js"));

            // Add files to the test suite
            files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

            try {
                // Run the mocha test
                mocha.run(failures => {
                    if (failures > 0) {
                        e(new Error(`${failures} tests failed.`));
                    } else {
                        c();
                    }
                });
            } catch (err) {
                e(err);
            }
        });
    });
}
