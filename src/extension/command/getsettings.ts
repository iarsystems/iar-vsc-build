/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";

import { CommandBase } from "./command";
import { ExtensionState } from "../extensionstate";
import { InputModel } from "../model/model";
import { AsyncObservable } from "../../utils/asyncobservable";
import { EwWorkspace } from "../../iar/workspace/ewworkspace";
import { EwwFile } from "../../iar/workspace/ewwfile";

export enum GetSettingsCommand {
    Workbench = "iar-config.toolchain",
    WorkspaceFile = "iar-config.workspace-file",
    ProjectFile = "iar-config.project-file",
    ProjectConfiguration = "iar-config.project-configuration",
    ProjectName = "iar-config.project-name",
    ArgVarFile = "iar-config.argument-variables-file",
}

class GetInputModelValue<T> extends CommandBase<string> {

    constructor(
        id: GetSettingsCommand,
        private readonly model: InputModel<T>,
        private readonly stringify: (item: T) => string | undefined
    ) {
        super(id);
    }

    executeImpl(): string {
        // We should not return undefined here. These commands are used as variables in e.g. tasks, and returning
        // undefined from a command variable will make the task fail silently.
        return this.model.selected ?
            (this.stringify(this.model.selected) ?? "") :
            "";
    }
}

// A command that requires a workspace
class WorkspaceCommand extends CommandBase<Promise<string>> {
    constructor(
        id: GetSettingsCommand,
        private readonly model: AsyncObservable<EwWorkspace>,
        private readonly executor: (ws: EwWorkspace) => string | undefined,
    ) {
        super(id);
    }

    protected override async executeImpl(): Promise<string> {
        const ws = await this.model.getValue();
        if (ws) {
            return this.executor(ws) ?? "";
        }
        return "";
    }
}

export namespace GetSettingsCommand {
    export function initCommands(context: Vscode.ExtensionContext): void {
        initCommand(context, GetSettingsCommand.Workbench,
            ExtensionState.getInstance().workbenches, workbench => workbench.path);
        initCommand(context, GetSettingsCommand.WorkspaceFile,
            ExtensionState.getInstance().workspaces, workspace => workspace.path);

        const workspaceModel = ExtensionState.getInstance().workspace;

        const projFileCmd = new WorkspaceCommand(GetSettingsCommand.ProjectFile,
            workspaceModel,
            workspace => workspace.projects.selected?.path);
        projFileCmd.register(context);
        const projNameCmd = new WorkspaceCommand(GetSettingsCommand.ProjectName,
            workspaceModel,
            workspace => workspace.projects.selected?.name);
        projNameCmd.register(context);

        const configCmd = new WorkspaceCommand(GetSettingsCommand.ProjectConfiguration,
            workspaceModel,
            workspace => workspace.projectConfigs?.selected?.name);
        configCmd.register(context);

        const argvarCmd = new WorkspaceCommand(GetSettingsCommand.ArgVarFile,
            workspaceModel,
            workspace => {
                if (workspace?.path) {
                    return EwwFile.findArgvarsFileFor(workspace.path);
                }
                return undefined;
            });
        argvarCmd.register(context);
    }

    function initCommand<T>(
        context: Vscode.ExtensionContext,
        command: GetSettingsCommand,
        model: InputModel<T>,
        stringify: (item: T) => string | undefined,
    ): void {
        const cmd = new GetInputModelValue(command, model, stringify);
        cmd.register(context);
    }
}
