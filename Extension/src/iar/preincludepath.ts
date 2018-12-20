'use strict';

import { XmlNode } from "../utils/XmlNode";
import { IarXml } from "../utils/xml";

export interface PreIncludePath {
    /**
     * Returns the path as in the xml file.
     */
    get(): string;

    /**
     * Returns the path but $PROJ_DIR$ is replaced by the path to the ewp file.
     */
    getAbsolute(): string;
}

export class XmlPreIncludePath {
    private xmlData: XmlNode;
    private projectPath: string;

    constructor(xml: XmlNode, projectPath: string) {
        this.xmlData = xml;
        this.projectPath = projectPath;

        if(xml.getTagName() !== "state") {
            throw new Error("Expected an xml element 'state' instead of '" + xml.getTagName() + "'.");
        }
    }

    public get(): string {
        let path = this.xmlData.getText();

        if (path) {
            return path;
        } else {
            return "";
        }
    }

    public getAbsolute(): string {
        let path = this.get();

        return path.replace('$PROJ_DIR$', this.projectPath);
    }

    public static parseFromconfiguration(xml: XmlNode, projectPath: string): PreIncludePath[] {
        let settings = IarXml.findSettingsFromConfig(xml, '/ICC.*/');

        if (settings) {
            let option = IarXml.findOptionFromSettings(settings, 'PreInclude');

            if (option) {
                let states = option.getAllChildsByName('state');
                let preIncludePaths: PreIncludePath[] = [];

                states.forEach(state => {
                    preIncludePaths.push(new XmlPreIncludePath(state, projectPath));
                });

                return preIncludePaths;
            }
        }

        return [];
    }
}