/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import { BuildTaskDefinition } from "./buildtaskprovider";
import { CommandUtils } from "../../../utils/utils";

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

    // private definition: BuildTaskDefinition;

    constructor(definition: BuildTaskDefinition) {
        // substitute command variables
        const resolvedDef: any = definition;
        for (const property in resolvedDef) {
            if (resolvedDef[property]) {
                resolvedDef[property] = CommandUtils.parseSettingCommands(resolvedDef[property]);
            }
        }
        // this.definition = resolvedDef;
	}

    open(_initialDimensions: Vscode.TerminalDimensions | undefined): void {
        // TODO: add a workbench.build or project.build or something, these services are no longer exposed
/*         const projectMgr = UI.getInstance().projectManager;
        const projectContext = UI.getInstance().projectContext;
        if (!projectMgr || !projectContext || !this.definition.config) {
            this.onError("Error: Make sure you select a workbench, project and configuration before running this task.");
            return;
        }

        this.writeEmitter.fire("Building project...\r\n");
        projectMgr.service.BuildProject(projectContext, this.definition.config).then(() => {
            this.writeEmitter.fire("Done!\r\n");
            this.closeEmitter.fire(undefined);
        }); */
    }

    close(): void {
    }

/*     private onError(reason: any) {
        this.writeEmitter.fire(reason + "\r\n");
        this.closeEmitter.fire();
    } */
}