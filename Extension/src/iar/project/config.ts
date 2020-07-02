/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import { XmlNode } from '../../utils/XmlNode';
import { IarXml } from "../../utils/xml";

export interface Config {
    readonly name: string;
    readonly toolchainId: string;
}

export class XmlConfig implements Config {
    private xml: XmlNode;

    constructor(xmlConfigElement: XmlNode) {
        this.xml = xmlConfigElement;

        if (this.xml.tagName !== 'configuration') {
            throw new Error("Expected an xml element 'configuration' instead of '" + this.xml.tagName + "'");
        }
    }

    public getXml() {
        return this.xml;
    }

    get name(): string {
        let name = IarXml.getNameTextFromElement(this.xml);

        if (name === undefined) {
            return "";
        } else {
            return name;
        }
    }

    get toolchainId(): string {
        const toolchainXml = this.xml.getFirstChildByName("toolchain");
        if (toolchainXml) {
            const toolchain = IarXml.getNameTextFromElement(toolchainXml);
            if (toolchain) {
                return toolchain;
            }
        }
        return "";
    }
}

export namespace Config {
    export function fromXml(projectXml: XmlNode): Config[] {
        let configs: Config[] = [];

        let xmlConfigs = projectXml.getAllChildsByName("configuration");

        xmlConfigs.forEach(config => {
            try {
                configs.push(new XmlConfig(config));
            } catch (e) {
            }
        });

        return configs;
    }
}
