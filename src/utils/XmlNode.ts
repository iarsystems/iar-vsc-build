/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as xmljs from "xml-js";

export class XmlNode {
    private readonly mElement: xmljs.Element;

    constructor(xml: xmljs.Element | string) {
        let element: xmljs.Element;

        if (typeof xml === "string") {
            const document = xmljs.xml2js(xml, { compact: false }) as xmljs.Element;
            if (document.elements?.[0] === undefined) {
                throw new Error("Invalid xml data");
            }

            element = document.elements[0];
        } else {
            element = xml;
        }

        this.mElement = element;
    }

    get tagName(): string | undefined {
        return this.mElement.name;
    }

    get text(): string | undefined {
        if (this.mElement.type === "text") {
            return "" + this.mElement.text;
        } else {
            const texts = this.getAllChildsByType("text");

            if (texts.length > 0) {
                let concatenated = "";

                texts.forEach(text => {
                    concatenated += text.mElement.text;
                });

                return concatenated;
            } else {
                return undefined;
            }
        }
    }

    public getFirstChildByName(element: string): XmlNode | undefined {
        if (this.mElement.elements) {
            const elem = this.mElement.elements.find(elem => elem.name === element);
            if (elem) {
                return new XmlNode(elem);
            }
        }

        return undefined;
    }

    public getFirstChildByType(type: string): XmlNode | undefined {
        if (this.mElement.elements) {
            const elem = this.mElement.elements.find(elem => elem.type === type);
            if (elem) {
                return new XmlNode(elem);
            }
        }

        return undefined;
    }

    public getAllChildsByName(name: string): XmlNode[] {
        if (this.mElement.elements) {
            return this.mElement.elements.filter(elem => elem.name === name).map(elem => new XmlNode(elem));
        }

        return [];
    }

    public getAllChildsByType(type: string): XmlNode[] {
        if (this.mElement.elements) {
            return this.mElement.elements.filter(elem => elem.type === type).map(elem => new XmlNode(elem));
        }

        return [];
    }
}