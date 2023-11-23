/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import { Command } from "../command/command";
import { ListInputModel } from "../model/model";
import { AsyncObservable } from "../../utils/asyncobservable";
import { EwWorkspace } from "../../iar/workspace/ewworkspace";
import { ProjectListModel } from "../model/selectproject";
import { ConfigurationListModel } from "../model/selectconfiguration";

export namespace StatusBarItem {

    /**
     * Creates a status bar button which shows a {@link ListInputModel}'s selected value.
     * Pressing the button prompts the user to select a new value.
     * @param id A unique identifier for the item
     * @param model The model to display
     * @param onClick The command to call when pressing the button
     * @param label The label to show in front of the model's selected value
     * @param priority Higher values will place the view more to the left in the status bar
     */
    export function createFromModel<T>(
        id: string,
        model: ListInputModel<T>,
        onClick: Command<unknown>,
        label: string,
        priority?: number) {

        const ui = Vscode.window.createStatusBarItem(id, Vscode.StatusBarAlignment.Left, priority);
        ui.command = onClick.id;
        ui.show();

        const updateText = () => {
            if (model.selectedIndex !== undefined) {
                ui.text = label + model.label(model.selectedIndex);
            } else {
                ui.text = label + "None selected";
            }
        };
        updateText();

        model.addOnSelectedHandler(() => updateText());

    }

    /**
     * Creates status bar items which show the projects in a workspace, and the
     * configurations in the workspace's active project.
     */
    export function createFromWorkspaceModel(
        workspace: AsyncObservable<EwWorkspace>,
        projectId: string,
        projectOnClick: Command<unknown>,
        projectLabel: string,
        projectPriority: number,
        configId: string,
        configOnClick: Command<unknown>,
        configLabel: string,
        configPriority: number) {

        createFromModel(projectId, new ProjectListModel, projectOnClick, projectLabel, projectPriority);
        createFromModel(configId, new ProjectListModel, configOnClick, configLabel, configPriority);

        workspace.onValueDidChange(workspace => {
            createFromModel(projectId, workspace?.projects ?? new ProjectListModel, projectOnClick, projectLabel, projectPriority);
            createFromModel(configId, workspace?.projectConfigs ?? new ConfigurationListModel, configOnClick, configLabel, configPriority);
        });
    }
}
