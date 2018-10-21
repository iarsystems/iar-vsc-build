'use strict';

import { XmlNode } from "../utils/XmlNode";
import { IarXml } from "../utils/xml";

export interface IncludePath {
    /**
     * Returns the path as in the xml file.
     */
    get(): string;

    /**
     * Returns the path but $PROJ_DIR$ is replaced by the path to the ewp file.
     */
    getAbsolute(): string;
}

export class XmlIncludePath {
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

        if(path) {
            return path;
        } else {
            return "";
        }
    }

    public getAbsolute(): string {
        let path = this.get();

        return path.replace('$PROJ_DIR$', this.projectPath);
    }

    public static parseFromconfiguration(xml: XmlNode, projectPath: string): IncludePath[] {
        let settings = IarXml.findSettingsFromConfig(xml, 'ICCARM');

        if(settings) {
            let option = IarXml.findOptionFromSettings(settings, 'CCIncludePath2');

            if(option) {
                let states = option.getAllChildsByName('state');
                let includePaths: IncludePath[] = [];

                states.forEach(state => {
                    includePaths.push(new XmlIncludePath(state, projectPath));
                });

                return includePaths;
            }
        }

        return [];
    }
}