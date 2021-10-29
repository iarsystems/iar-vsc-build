/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import { XmlNode } from "./XmlNode";

export namespace IarXml {
    export function findSettingsFromConfig(xml: XmlNode, name: string): XmlNode | undefined {
        const settings = xml.getAllChildsByName("settings");

        for (let idx = 0; idx < settings.length; idx += 1) {
            const setting = settings[idx];

            if (validateText(getNameTextFromElement(setting), name)) {
                return setting;
            }
        }

        return undefined;
    }

    export function findOptionFromSettings(xml: XmlNode, name: string): XmlNode | undefined {
        const data = xml.getFirstChildByName("data");

        if (!data) {
            return undefined;
        }

        const options = data.getAllChildsByName("option");

        for (let idx = 0; idx < options.length; idx += 1) {
            const option = options[idx];

            if (validateText(getNameTextFromElement(option), name)) {
                return option;
            }
        }

        return undefined;
    }

    export function getNameTextFromElement(xml: XmlNode): string | undefined {
        const nameElement = xml.getFirstChildByName("name");

        if (nameElement) {
            return nameElement.text;
        }

        return undefined;
    }

    function validateText(content: string | undefined, validate: string): boolean {
        if (content === undefined) {
            return false;
        }

        if ((validate[0] === "/") && (validate[validate.length - 1] === "/")) {
            const regex = new RegExp(validate.substr(1, validate.length - 2));

            return regex.test(content);
        } else {
            return content === validate;
        }
    }
}