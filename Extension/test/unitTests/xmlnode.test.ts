/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as assert from "assert";
import { XmlNode } from "../../src/utils/XmlNode";

suite("XmlNode validation", () => {
    suite("Test tagName property", () => {
        test("Valid Node", () => {
            const xml = "<root></root>";

            const node = new XmlNode(xml);

            assert.strictEqual(node.tagName, "root");
        });
    });

    suite("Test text property", () => {
        test("Node has text", () => {
            const text = "Some text";
            const xml = "<root>" + text + "</root>";

            const node = new XmlNode(xml);

            assert.strictEqual(node.text, text);
        });

        test("Node has no text", () => {
            const xml = "<root> </root>";

            const node = new XmlNode(xml);

            assert.strictEqual(node.text, undefined);
        });


        test("Node has child", () => {
            const xml = "<root><child></child></root>";

            const node = new XmlNode(xml);

            assert.strictEqual(node.text, undefined);
        });
    });

    suite("Test getFirstChildByName", () => {
        test("Has no satisfying children", () => {
            const xml = "<root><child /></root>";

            const node = new XmlNode(xml);

            const unexistendChild = node.getFirstChildByName("unknownChild");

            assert.strictEqual(unexistendChild, undefined);
        });

        test("Has one satisfying child", () => {
            const xml = "<root><child1 /><child2 /></root>";

            const node = new XmlNode(xml);

            let child1 = node.getFirstChildByName("child1");
            let child2 = node.getFirstChildByName("child2");

            assert.notStrictEqual(child1, undefined);
            assert.notStrictEqual(child2, undefined);

            child1 = child1 as XmlNode; // we are sure child1 is not undefined
            child2 = child2 as XmlNode; // we are sure child2 is not undefined

            assert.strictEqual(child1.tagName, "child1");
            assert.strictEqual(child2.tagName, "child2");
        });

        test("Has multiple satisfying children", () => {
            const xml = "<root><child1>1</child1><child1>2</child1></root>";

            const node = new XmlNode(xml);

            let first = node.getFirstChildByName("child1");

            assert.notStrictEqual(first, undefined);

            first = first as XmlNode; // we are sure first is not undefined

            assert.strictEqual(first.text, "1");
        });
    });

    suite("getAllChildsByName", () => {
        test("Has no satisfying children", () => {
            const xml = "<root><child /></root>";

            const node = new XmlNode(xml);

            const unexistendChild = node.getAllChildsByName("unknownChild");

            assert.strictEqual(unexistendChild.length, 0);
        });

        test("Has one satisfying child", () => {
            const xml = "<root><child1 /><child2>1</child2></root>";

            const node = new XmlNode(xml);

            const child1 = node.getAllChildsByName("child1");
            const child2 = node.getAllChildsByName("child2");

            assert.strictEqual(child1.length, 1);
            assert.strictEqual(child2.length, 1);

            assert.strictEqual(child1[0]!.tagName, "child1");
            assert.strictEqual(child2[0]!.tagName, "child2");
            assert.strictEqual(child1[0]!.text, undefined);
            assert.strictEqual(child2[0]!.text, "1");
        });

        test("Has multiple satisfying children", () => {
            const xml = "<root><child1>1</child1><child1>2</child1></root>";

            const node = new XmlNode(xml);

            const children = node.getAllChildsByName("child1");

            assert.strictEqual(children.length, 2);
            assert.strictEqual(children[0]!.tagName, "child1");
            assert.strictEqual(children[1]!.tagName, "child1");
            assert.strictEqual(children[0]!.text, "1");
            assert.strictEqual(children[1]!.text, "2");
        });
    });

    suite("Test getFirstChildByType", () => {
        test("Has no satisfying children", () => {
            const xml = "<root><child></child></root>";

            const node = new XmlNode(xml);

            const unexistendChild = node.getFirstChildByType("text");

            assert.strictEqual(unexistendChild, undefined);
        });

        test("Has one satisfying child", () => {
            const xml = "<root><child1 /><child2 /></root>";

            const node = new XmlNode(xml);

            let child1 = node.getFirstChildByType("element");

            assert.notStrictEqual(child1, undefined);

            child1 = child1 as XmlNode; // we are sure child1 is not undefined

            assert.strictEqual(child1.tagName, "child1");
        });

        test("Has multiple satisfying children", () => {
            const xml = "<root>text<child1 /><child2 /></root>";

            const node = new XmlNode(xml);

            let first = node.getFirstChildByType("element");
            let text = node.getFirstChildByType("text");

            assert.notStrictEqual(first, undefined);
            assert.notStrictEqual(text, undefined);

            first = first as XmlNode; // we are sure first is not undefined
            text = text as XmlNode; // we are sure text is not undefined

            assert.strictEqual(first.tagName, "child1");
            assert.strictEqual(text.text, "text");
        });
    });

    suite("getAllChildsByType", () => {
        test("Has no satisfying children", () => {
            const xml = "<root><child /></root>";

            const node = new XmlNode(xml);

            const unexistendChild = node.getAllChildsByType("unknownType");

            assert.strictEqual(unexistendChild.length, 0);
        });

        test("Has one satisfying child", () => {
            const xml = "<root><child1 /></root>";

            const node = new XmlNode(xml);

            const child1 = node.getAllChildsByType("element");

            assert.strictEqual(child1.length, 1);

            assert.strictEqual(child1[0]!.tagName, "child1");
            assert.strictEqual(child1[0]!.text, undefined);
        });

        test("Has multiple satisfying children", () => {
            const xml = "<root>some text<child1>1</child1><child2>2</child2></root>";

            const node = new XmlNode(xml);

            const children = node.getAllChildsByType("element");
            const text = node.getAllChildsByType("text");

            assert.strictEqual(children.length, 2);
            assert.strictEqual(children[0]!.tagName, "child1");
            assert.strictEqual(children[1]!.tagName, "child2");
            assert.strictEqual(children[0]!.text, "1");
            assert.strictEqual(children[1]!.text, "2");

            assert.strictEqual(text.length, 1);
            assert.strictEqual(text[0]!.text, "some text");
        });
    });
});
