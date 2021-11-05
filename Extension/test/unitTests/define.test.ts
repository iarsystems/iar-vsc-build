/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Assert from "assert";
import { Define } from "../../src/extension/configprovider/data/define";

suite("Test define parsers", () => {
    suite("Test source file parser", () => {
        test("Empty value define", () => {
            const line = "#define DEBUG";

            const define = Define.fromSourceContent(line);

            Assert.equal(define.length, 1);
            Assert.equal(define[0]!.identifier, "DEBUG");
            Assert.equal(define[0]!.value, undefined);
        });

        test("Empty value define with trailing spaces", () => {
            const line = "#define DEBUG    ";

            const define = Define.fromSourceContent(line);

            Assert.equal(define.length, 1);
            Assert.equal(define[0]!.identifier, "DEBUG");
            Assert.equal(define[0]!.value, undefined);
        });

        test("Define with value", () => {
            const line = "#define DEBUG 1";

            const define = Define.fromSourceContent(line);

            Assert.equal(define.length, 1);
            Assert.equal(define[0]!.identifier, "DEBUG");
            Assert.equal(define[0]!.value, "1");
        });

        test("Define with more complex value", () => {
            const line = "#define Complex_define (1 + 5) * 10UL";

            const define = Define.fromSourceContent(line);

            Assert.equal(define.length, 1);
            Assert.equal(define[0]!.identifier, "Complex_define");
            Assert.equal(define[0]!.value, "(1 + 5) * 10UL");
        });

        test("Remove extra spaces in define", () => {
            const line = "  #define    Complex_define     ( 1 + 5 ) * 10UL    ";

            const define = Define.fromSourceContent(line);

            Assert.equal(define.length, 1);
            Assert.equal(define[0]!.identifier, "Complex_define");
            Assert.equal(define[0]!.value, "( 1 + 5 ) * 10UL");
        });

        test("Macro", () => {
            const line = "#define SUM(a, b) (a + b)";

            const define = Define.fromSourceContent(line);

            Assert.equal(define.length, 1);
            Assert.equal(define[0]!.identifier, "SUM(a, b)");
            Assert.equal(define[0]!.value, "(a + b)");
        });

        test("Macro with additional spaces", () => {
            const line = "  #define SUM(a, b)   ( a + b )   ";

            const define = Define.fromSourceContent(line);

            Assert.equal(define.length, 1);
            Assert.equal(define[0]!.identifier, "SUM(a, b)");
            Assert.equal(define[0]!.value, "( a + b )");
        });

        test("Multiline define source", () => {
            const lines = `
            #define DEBUG
            #define  SOME_CONSTANT_FORMULA 2 * PI
            #define AREA(l, h) (l * h)
            `;

            const defines = Define.fromSourceContent(lines);

            Assert.equal(defines.length, 3);

            Assert.equal(defines[0]!.identifier, "DEBUG");
            Assert.equal(defines[0]!.value, undefined);

            Assert.equal(defines[1]!.identifier, "SOME_CONSTANT_FORMULA");
            Assert.equal(defines[1]!.value, "2 * PI");

            Assert.equal(defines[2]!.identifier, "AREA(l, h)");
            Assert.equal(defines[2]!.value, "(l * h)");
        });
    });
});
