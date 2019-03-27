/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

'use strict';

import { XmlNode } from "./XmlNode";

export namespace IarXml {
    export function findSettingsFromConfig(xml: XmlNode, name: string): XmlNode | undefined {
        let settings = xml.getAllChildsByName('settings');

        for (let idx = 0; idx < settings.length; idx += 1) {
            let setting = settings[idx];

            if (validateText(getNameTextFromElement(setting), name)) {
                return setting;
            }
        }

        return undefined;
    }

    export function findOptionFromSettings(xml: XmlNode, name: string): XmlNode | undefined {
        let data = xml.getFirstChildByName('data');

        if (!data) {
            return undefined;
        }

        let options = data.getAllChildsByName('option');

        for (let idx = 0; idx < options.length; idx += 1) {
            let option = options[idx];

            if (validateText(getNameTextFromElement(option), name)) {
                return option;
            }
        }

        return undefined;
    }

    export function getNameTextFromElement(xml: XmlNode): string | undefined {
        let nameElement = xml.getFirstChildByName('name');

        if (nameElement) {
            return nameElement.text;
        }

        return undefined;
    }

    function validateText(content: string | undefined, validate: string): boolean {
        if (content === undefined) {
            return false;
        }

        if ((validate[0] === '/') && (validate[validate.length - 1] === '/')) {
            let regex = new RegExp(validate.substr(1, validate.length - 2));

            return regex.test(content);
        } else {
            return content === validate;
        }
    }

    export function findToolchainFromConfig(xml: XmlNode): XmlNode | undefined {
        let settings = xml.getAllChildsByName('toolchain');

        for (let idx = 0; idx < settings.length; idx += 1) {
            let setting = settings[idx];
            return setting;
        }

        return undefined;
    }
}