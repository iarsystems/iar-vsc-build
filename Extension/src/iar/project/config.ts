'use strict';

import * as Fs from "fs";

import { XmlNode } from '../../utils/XmlNode';
import { Define } from './define';
import { IncludePath } from './includepaths';
import { PreIncludePath } from './preincludepath';

export interface Config {
    readonly defines: Define[];
    readonly includes: IncludePath[];
    readonly preIncludes: PreIncludePath[];
}

class XmlConfig implements Config {
    readonly defines: Define[];
    readonly includes: IncludePath[];
    readonly preIncludes: PreIncludePath[];

    constructor(xmlConfigElement: XmlNode, ewpPath: Fs.PathLike) {
        if (xmlConfigElement.tagName !== 'configuration') {
            throw new Error("Expected an xml element 'configuration' instead of '" + xmlConfigElement.tagName + "'");
        }

        this.defines = Define.fromXml(xmlConfigElement);
        this.includes = IncludePath.fromXmlData(xmlConfigElement, ewpPath);
        this.preIncludes = PreIncludePath.fromXml(xmlConfigElement, ewpPath);
    }
}

export namespace Config {
    export function fromXml(projectXml: XmlNode, ewpPath: Fs.PathLike): Config[] {
        let configs: Config[] = [];

        let xmlConfigs = projectXml.getAllChildsByName("configuration");

        xmlConfigs.forEach(config => {
            try {
                configs.push(new XmlConfig(config, ewpPath));
            } catch (e) {
            }
        });

        return configs;
    }
}
