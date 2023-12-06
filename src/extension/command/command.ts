/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as Vscode from "vscode";
import { Input, ListInput } from "../ui/listinput";
import { ListInputModel } from "../model/model";
import { Workbench } from "iar-vsc-common/workbench";
import { EwwFile } from "../../iar/workspace/ewwfile";
import { AsyncObservable } from "../../utils/asyncobservable";
import { EwWorkspace } from "../../iar/workspace/ewworkspace";

/**
 * A VS Code command.
 * @typeParam T the type of value the command returns
 */
export interface Command<T> {
    readonly id: string;

    execute(autoTriggered?: boolean): T | undefined;
    register(context: Vscode.ExtensionContext): void;
}

export abstract class CommandBase<T> implements Command<T> {
    readonly id: string;

    constructor(id: string) {
        this.id = id;
    }

    execute(autoTriggered?: boolean): T | undefined {
        return this.executeImpl(autoTriggered);
    }

    register(context: Vscode.ExtensionContext): void {
        const cmd = Vscode.commands.registerCommand(this.id, this.executeImpl, this);
        context.subscriptions.push(cmd);
    }

    protected abstract executeImpl(autoTriggered?: boolean): T;
}

/**
 * Prompts the user to select a value from the list model and updates the model's selected value
 */
class ListSelectionCommand<T> extends CommandBase<void> {
    private readonly input: Input<T>;

    constructor(id: string, model: ListInputModel<T>) {
        super(id);

        this.input = new ListInput(model);
    }

    protected override executeImpl(_autoTriggered?: boolean): void {
        this.input.show();
    }
}

class SelectProjectCommand extends CommandBase<Promise<void>> {
    constructor(id: string, private readonly workspaceModel: AsyncObservable<EwWorkspace>) {
        super(id);
    }
    protected override async executeImpl(_autoTriggered?: boolean | undefined): Promise<void> {
        const workspace = await this.workspaceModel.getValue();
        if (workspace) {
            const input = new ListInput(workspace.projects);
            input.show();
        }
    }
}
class SelectConfigCommand extends CommandBase<Promise<void>> {
    constructor(id: string, private readonly workspaceModel: AsyncObservable<EwWorkspace>) {
        super(id);
    }
    protected override async executeImpl(_autoTriggered?: boolean | undefined): Promise<void> {
        const workspace = await this.workspaceModel.getValue();
        if (workspace) {
            const input = new ListInput(workspace.projectConfigs);
            input.show();
        }
    }
}

export namespace Command {
    export function createSelectWorkbenchCommand(model: ListInputModel<Workbench>): CommandBase<void> {
        return new ListSelectionCommand("iar-build.selectToolchain", model);
    }

    export function createSelectWorkspaceCommand(model: ListInputModel<EwwFile>): CommandBase<void> {
        return new ListSelectionCommand("iar-build.selectWorkspace", model);
    }

    export function createSelectProjectCommand(workspaceModel: AsyncObservable<EwWorkspace>): CommandBase<Promise<void>> {
        return new SelectProjectCommand("iar-build.selectProject", workspaceModel);
    }

    export function createSelectConfigurationCommand(workspaceModel: AsyncObservable<EwWorkspace>): CommandBase<Promise<void>> {
        return new SelectConfigCommand("iar-build.selectConfiguration", workspaceModel);
    }

}
