/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import { ListSelectionCommand } from "../command/command";
import { InputModel } from "../model/model";

export namespace SelectionView {

    /**
     * Creates a status bar button which shows a {@link ListInputModel}'s selected value.
     * Pressing the button prompts the user to select a new value.
     * @param command The command to call when pressing the button
     * @param model The model to display
     * @param label The label to show in front of the model's selected value
     * @param priority Higher values will place the view more to the left in the status bar
     */
    export function createSelectionView<T>(command: ListSelectionCommand<T>,
        model: InputModel<T>,
        label: string,
        priority?: number) {

        const ui = Vscode.window.createStatusBarItem(Vscode.StatusBarAlignment.Left, priority);
        ui.command = command.id;
        ui.show();

        const updateText = () => {
            if (model.selected) {
                ui.text = label + model.selectedText;
            } else {
                ui.text = label + "None selected";
            }
        };
        updateText();

        model.addOnSelectedHandler(() => updateText());

    }
}
