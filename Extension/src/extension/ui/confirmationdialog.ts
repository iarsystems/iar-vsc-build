/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";

export namespace ConfirmationDialog {
    /**
     * Shows a yes-no prompt to the user and returns their response
     * @param prompt A string prompt to show to the user
     * @returns undefined if the prompt was canceled, otherwise a boolean for the response
     */
    export async function show(prompt: string): Promise<boolean | undefined> {
        const response = await Vscode.window.showQuickPick(["Yes", "No"], { placeHolder: prompt });
        if (!response) {
            return Promise.resolve(undefined);
        }
        return Promise.resolve(response === "Yes");
    }
}