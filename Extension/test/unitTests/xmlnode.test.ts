/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as assert from "assert";
import { XmlNode } from "../../src/utils/XmlNode";

suite("XmlNode validation", () => {
    suite("Test tagName property", () => {
        test("Valid Node", () => {
            const xml = "<root></root>";

            let node = new XmlNode(xml);

            assert.equal(node.tagName, "root");
        });
    });

    suite("Test text property", () => {
        test("Node has text", () => {
            const text = "Some text";
            const xml = "<root>" + text + "</root>";

            let node = new XmlNode(xml);

            assert.equal(node.text, text);
        });

        test("Node has no text", () => {
            const xml = "<root> </root>";

            let node = new XmlNode(xml);

            assert.equal(node.text, undefined);
        });


        test("Node has child", () => {
            const xml = "<root><child></child></root>";

            let node = new XmlNode(xml);

            assert.equal(node.text, undefined);
        });
    });

    suite("Test getFirstChildByName", () => {
        test("Has no satisfying children", () => {
            const xml = "<root><child /></root>";

            let node = new XmlNode(xml);

            let unexistendChild = node.getFirstChildByName("unknownChild");

            assert.equal(unexistendChild, undefined);
        });

        test("Has one satisfying child", () => {
            const xml = "<root><child1 /><child2 /></root>";

            let node = new XmlNode(xml);

            let child1 = node.getFirstChildByName("child1");
            let child2 = node.getFirstChildByName("child2");

            assert.notEqual(child1, undefined);
            assert.notEqual(child2, undefined);

            child1 = child1 as XmlNode; // we are sure child1 is not undefined
            child2 = child2 as XmlNode; // we are sure child2 is not undefined

            assert.equal(child1.tagName, "child1");
            assert.equal(child2.tagName, "child2");
        });

        test("Has multiple satisfying children", () => {
            const xml = "<root><child1>1</child1><child1>2</child1></root>";

            let node = new XmlNode(xml);

            let first = node.getFirstChildByName("child1");

            assert.notEqual(first, undefined);

            first = first as XmlNode; // we are sure first is not undefined

            assert.equal(first.text, "1");
        });
    });

    suite("getAllChildsByName", () => {
        test("Has no satisfying children", () => {
            const xml = "<root><child /></root>";

            let node = new XmlNode(xml);

            let unexistendChild = node.getAllChildsByName("unknownChild");

            assert.equal(unexistendChild.length, 0);
        });

        test("Has one satisfying child", () => {
            const xml = "<root><child1 /><child2>1</child2></root>";

            let node = new XmlNode(xml);

            let child1 = node.getAllChildsByName("child1");
            let child2 = node.getAllChildsByName("child2");

            assert.equal(child1.length, 1);
            assert.equal(child2.length, 1);

            assert.equal(child1[0].tagName, "child1");
            assert.equal(child2[0].tagName, "child2");
            assert.equal(child1[0].text, undefined);
            assert.equal(child2[0].text, "1");
        });

        test("Has multiple satisfying children", () => {
            const xml = "<root><child1>1</child1><child1>2</child1></root>";

            let node = new XmlNode(xml);

            let children = node.getAllChildsByName("child1");

            assert.equal(children.length, 2);
            assert.equal(children[0].tagName, "child1");
            assert.equal(children[1].tagName, "child1");
            assert.equal(children[0].text, "1");
            assert.equal(children[1].text, "2");
        });
    });

    suite("Test getFirstChildByType", () => {
        test("Has no satisfying children", () => {
            const xml = "<root><child></child></root>";

            let node = new XmlNode(xml);

            let unexistendChild = node.getFirstChildByType("text");

            assert.equal(unexistendChild, undefined);
        });

        test("Has one satisfying child", () => {
            const xml = "<root><child1 /><child2 /></root>";

            let node = new XmlNode(xml);

            let child1 = node.getFirstChildByType("element");

            assert.notEqual(child1, undefined);

            child1 = child1 as XmlNode; // we are sure child1 is not undefined

            assert.equal(child1.tagName, "child1");
        });

        test("Has multiple satisfying children", () => {
            const xml = "<root>text<child1 /><child2 /></root>";

            let node = new XmlNode(xml);

            let first = node.getFirstChildByType("element");
            let text = node.getFirstChildByType("text");

            assert.notEqual(first, undefined);
            assert.notEqual(text, undefined);

            first = first as XmlNode; // we are sure first is not undefined
            text = text as XmlNode; // we are sure text is not undefined

            assert.equal(first.tagName, "child1");
            assert.equal(text.text, "text");
        });
    });

    suite("getAllChildsByType", () => {
        test("Has no satisfying children", () => {
            const xml = "<root><child /></root>";

            let node = new XmlNode(xml);

            let unexistendChild = node.getAllChildsByType("unknownType");

            assert.equal(unexistendChild.length, 0);
        });

        test("Has one satisfying child", () => {
            const xml = "<root><child1 /></root>";

            let node = new XmlNode(xml);

            let child1 = node.getAllChildsByType("element");

            assert.equal(child1.length, 1);

            assert.equal(child1[0].tagName, "child1");
            assert.equal(child1[0].text, undefined);
        });

        test("Has multiple satisfying children", () => {
            const xml = "<root>some text<child1>1</child1><child2>2</child2></root>";

            let node = new XmlNode(xml);

            let children = node.getAllChildsByType("element");
            let text = node.getAllChildsByType("text");

            assert.equal(children.length, 2);
            assert.equal(children[0].tagName, "child1");
            assert.equal(children[1].tagName, "child2");
            assert.equal(children[0].text, "1");
            assert.equal(children[1].text, "2");

            assert.equal(text.length, 1);
            assert.equal(text[0].text, "some text");
        });
    });
});
