'use strict';

import { XmlNode } from "./XmlNode";
import { IarXml } from "../utils/xml";

export class Define {
    private xmlData: XmlNode;

    constructor(xml: XmlNode) {
        this.xmlData = xml;

        if(xml.getTagName() !== "state") {
            throw new Error("Expected an xml element 'state' instead of '" + xml.getTagName() + "'.");
        }
    }

    public get(): string {
        let define = this.xmlData.getText();

        if(define) {
            return define;
        } else {
            return "";
        }
    }

    public static parseDefinesFromconfiguration(xml: XmlNode): Define[] {
        let settings = IarXml.findSettingsFromConfig(xml, 'ICCARM');

        if(settings) {
            let option = IarXml.findOptionFromSettings(settings, 'CCDefines');

            if(option) {
                let states = option.getAllChildsByName('state');
                let defines: Define[] = [];

                states.forEach(state => {
                    defines.push(new Define(state));
                });

                return defines;
            }
        }

        return [];
    }
}