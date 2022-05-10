/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { logger } from "iar-vsc-common/logger";
import * as Vscode from "vscode";
import { IarVsc } from "../main";

export enum InformationMessageType {
    Info,
    Warning,
    Error,
}

export namespace InformationMessage {
    /**
     * Shows a notification informing the user about something, with a "Do not show again" button
     * @param id A unique identifier for this dialog, used to persist "Do not show again" clicks
     * @param prompt A string prompt to show to the user
     * @param type The type of dialog, affects the icon shown to the user
     */
    export async function show(id: string, prompt: string, type: InformationMessageType): Promise<void> {
        const key = id + ".donotshow";
        const doNotShow = IarVsc.extensionContext?.globalState.get<boolean>(key);
        if (doNotShow) {
            logger.debug(`Ignoring dialog ${id} ('do not show again' has been pressed)`);
            return;
        }

        const options = ["Do Not Show Again"];
        let result: Thenable<string | undefined>;
        switch (type) {
        case InformationMessageType.Info:
            result = Vscode.window.showInformationMessage(prompt, ...options);
            break;
        case InformationMessageType.Warning:
            result = Vscode.window.showWarningMessage(prompt, ...options);
            break;
        case InformationMessageType.Error:
        default:
            result = Vscode.window.showErrorMessage(prompt, ...options);
            break;
        }

        const response = await result;
        if (response === options[0]) {
            IarVsc.extensionContext?.globalState.update(key, true);
            logger.debug(`Ignoring future ${id} dialogs ('do not show again' was pressed)`);
        }
    }
}