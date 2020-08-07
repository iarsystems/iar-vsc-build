/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import { BuildTaskDefinition } from "./buildtaskprovider";
import { CommandUtils } from "../../../utils/utils";
import { UI } from "../../ui/app";

/**
 * Executes a build task using a thrift service.
 * The Pseudoterminal is needed for custom task executions, and based on the official example:
 * https://github.com/microsoft/Vscode-extension-samples/blob/master/task-provider-sample/src/customTaskProvider.ts
 */
export class BuildTaskExecution implements Vscode.Pseudoterminal {
    private writeEmitter = new Vscode.EventEmitter<string>();
	onDidWrite: Vscode.Event<string> = this.writeEmitter.event;
	private closeEmitter = new Vscode.EventEmitter<void>();
	onDidClose?: Vscode.Event<void> = this.closeEmitter.event;

    onDidOverrideDimensions?: Vscode.Event<Vscode.TerminalDimensions | undefined> | undefined;

    private definition: BuildTaskDefinition;

    constructor(definition: BuildTaskDefinition) {
        // substitute command variables
        const resolvedDef: any = definition;
        for (const property in resolvedDef) {
            if (resolvedDef[property]) {
                resolvedDef[property] = CommandUtils.parseSettingCommands(resolvedDef[property]);
            }
        }
        this.definition = resolvedDef;
	}

    async open(_initialDimensions: Vscode.TerminalDimensions | undefined)  {
        // TODO: there should be a standardized way of getting the reason e.g. an extended
        //       project is not available (no workbench, workbench doesn't support thrift, no project selected etc.)
        const project = await UI.getInstance().extendedProject.selectedPromise;
        if (!project) {
            this.onError("No project loaded or the workbench does not support the operation.");
            return;
        }
        const configName = this.definition.config;
        const config = project.configurations.find(conf => conf.name === configName);
        if (!config) {
            this.onError(`No configuration '${configName}' exists on the project '${project.name}'.`);
            return;
        }
        try {
            await project.build(config);
            this.writeEmitter.fire("Build finished!\r\n");
            this.closeEmitter.fire();
        } catch(e) {
            this.onError(e.toString());
        }
    }

    close(): void {
    }

    private onError(reason: any) {
        this.writeEmitter.fire("Failed building project: " + reason + "\r\n");
        this.closeEmitter.fire();
    }
}