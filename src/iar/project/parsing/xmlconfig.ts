/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import { IarXml } from "../../../utils/xml";
import { XmlNode } from "../../../utils/XmlNode";
import { Config } from "../config";

export class XmlConfig implements Config {
    private readonly xml: XmlNode;

    constructor(xmlConfigElement: XmlNode) {
        this.xml = xmlConfigElement;

        if (this.xml.tagName !== "configuration") {
            throw new Error("Expected an xml element 'configuration' instead of '" + this.xml.tagName + "'");
        }
    }

    public getXml() {
        return this.xml;
    }

    get name(): string {
        const name = IarXml.getNameTextFromElement(this.xml);

        if (name === undefined) {
            return "";
        } else {
            return name;
        }
    }

    get targetId(): string {
        const toolchainXml = this.xml.getFirstChildByName("toolchain");
        if (toolchainXml) {
            const toolchain = IarXml.getNameTextFromElement(toolchainXml);
            if (toolchain) {
                return Config.toolchainIdToTargetId(toolchain);
            }
        }
        return "";
    }
}

export namespace XmlConfig {
    export function fromXml(projectXml: XmlNode): Config[] {
        const configs: Config[] = [];

        const xmlConfigs = projectXml.getAllChildsByName("configuration");

        xmlConfigs.forEach(config => {
            try {
                configs.push(new XmlConfig(config));
            } catch (e) {
            }
        });

        return configs;
    }
}