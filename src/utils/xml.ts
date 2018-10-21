'use strict';

import { XmlNode } from "../iar/XmlNode";

export namespace IarXml {
    export function findSettingsFromConfig(xml: XmlNode, name: string): XmlNode | undefined {
        let settings = xml.getAllChildsByName('settings');

        for(let idx=0; idx<settings.length; idx += 1) {
            let setting = settings[idx];

            if(getNameTextFromElement(setting) === name) {
                return setting;
            }
        }

        return undefined;
    }

    export function findOptionFromSettings(xml: XmlNode, name: string): XmlNode | undefined {
        let data = xml.getFirstChildByName('data');
        
        if(!data) {
            return undefined;
        }

        let options = data.getAllChildsByName('option');

        for(let idx=0; idx<options.length; idx += 1) {
            let option = options[idx];

            if(getNameTextFromElement(option) === name) {
                return option;
            }
        }

        return undefined;
    }

    export function getNameTextFromElement(xml: XmlNode): string | undefined {
        let nameElement = xml.getFirstChildByName('name');

        if(nameElement) {
            return nameElement.getText();
        }

        return undefined;
    }
}