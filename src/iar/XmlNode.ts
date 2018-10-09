'use strict';

import * as xmljs from 'xml-js';

export class XmlNode {
    private mElement: xmljs.Element;

    constructor(element: xmljs.Element) {
        this.mElement = element;
    }

    public getXmlJsObject(): xmljs.Element {
        return this.mElement;
    }

    public getFirstChildByName(element: string): XmlNode | undefined {
        if (this.mElement.elements) {
            for (let idx = 0; idx < this.mElement.elements.length; idx += 1) {
                if (this.mElement.elements[idx].name === element) {
                    return new XmlNode(this.mElement.elements[idx]);
                }
            }
        }

        return undefined;
    }

    public getFirstChildByType(type: string): XmlNode | undefined {
        if (this.mElement.elements) {
            for (let idx = 0; idx < this.mElement.elements.length; idx += 1) {
                if (this.mElement.elements[idx].type === type) {
                    return new XmlNode(this.mElement.elements[idx]);
                }
            }
        }

        return undefined;
    }

    public getAllChildsByName(name: string): XmlNode[] {
        let ret: XmlNode[] = [];

        if (this.mElement.elements) {
            for (let idx = 0; idx < this.mElement.elements.length; idx += 1) {
                if (this.mElement.elements[idx].name === name) {
                    ret.push(new XmlNode(this.mElement.elements[idx]));
                }
            }
        }

        return ret;
    }

    public getAllChildsByType(type: string): XmlNode[] {
        let ret: XmlNode[] = [];

        if (this.mElement.elements) {
            for (let idx = 0; idx < this.mElement.elements.length; idx += 1) {
                let element = this.mElement.elements[idx];

                if (element.type === type) {
                    ret.push(new XmlNode(element));
                }
            }
        }

        return ret;
    }

    public getText(): string | undefined {
        let texts = this.getAllChildsByType('text');

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