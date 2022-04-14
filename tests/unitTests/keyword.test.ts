/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Assert from "assert";
import { Keyword } from "../../src/extension/configprovider/data/keyword";

suite("Test keyword parsers", () => {
    suite("Test .cfg file parser", () => {
        test("Empty contents", () => {
            const src = "";

            const keywords = Keyword.fromSyntaxFileContents(src);

            Assert.strictEqual(keywords.length, 0);
        });

        test("Several keywords", () => {
            const src = "word1\n__word2\n_w_o_r_d_3";

            const keywords = Keyword.fromSyntaxFileContents(src);

            Assert.strictEqual(keywords.length, 3);
            Assert.strictEqual(keywords[0]!.identifier, "word1");
            Assert.strictEqual(keywords[1]!.identifier, "__word2");
            Assert.strictEqual(keywords[2]!.identifier, "_w_o_r_d_3");
        });

        test("Untrimmed keywords", () => {
            const src = "   word1\n __word2 \n_w_o_r_d_3   ";

            const keywords = Keyword.fromSyntaxFileContents(src);

            Assert.strictEqual(keywords.length, 3);
            Assert.strictEqual(keywords[0]!.identifier, "word1");
            Assert.strictEqual(keywords[1]!.identifier, "__word2");
            Assert.strictEqual(keywords[2]!.identifier, "_w_o_r_d_3");
        });

        test("Empty lines", () => {
            const src = "\n\nword1\n__word2\n   \n_w_o_r_d_3\n\n\n";

            const keywords = Keyword.fromSyntaxFileContents(src);

            Assert.strictEqual(keywords.length, 3);
            Assert.strictEqual(keywords[0]!.identifier, "word1");
            Assert.strictEqual(keywords[1]!.identifier, "__word2");
            Assert.strictEqual(keywords[2]!.identifier, "_w_o_r_d_3");
        });
    });
});
