/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { IarVsc } from "../main";
import { ExtensionState } from "../extensionstate";
import { Project } from "../../iar/project/project";
import { Config } from "../../iar/project/config";
import { BatchBuildNode, NodeType, BatchBuildItemNode } from "./treebatchbuildprovider";
import * as Vscode from "vscode";
import * as Fs from "fs";
import { BuildTasks, Context } from "../task/buildtasks";

export namespace BatchBuild {

    export function Init(context: Vscode.ExtensionContext) {
        new AddBatch().register(context);
        new AddConfigurationBatch().register(context);
        new RemoveBatchElement().register(context);
        new BuildBatchCommand().register(context);
        new CleanBatchCommand().register(context);
        new RebuildBatchCommand().register(context);
    }

    /**
     * Base class for commands that are called as context buttons from the {@link TreeProjectView} (where files and configs are managed).
     */
    abstract class BatchCommand<T> {

        constructor(public command: string) {
        }

        register(context: Vscode.ExtensionContext): void {
            const cmd = Vscode.commands.registerCommand(this.command, (source): Promise<void> => {
                return Promise.resolve(this.execute(source));
            }, this);

            context.subscriptions.push(cmd);
        }

        /**
         * Called to run the command
         * @param source The item in the tree view that was clicked to spawn this command.
         *      For command buttons in the view title, this is the tree item that is currently focused (or undefined if no item is focused)
         */
        abstract execute(source: T | undefined): void | Promise<void>;
    }

    /**
     * Class for adding a new batch to the batch build system.
     */
    export class AddBatch extends BatchCommand<BatchBuildNode> {
        constructor() {
            super("iar-build.addBatch");
        }

        async execute(source: BatchBuildNode | undefined) {
            source = IarVsc.batchbuildTreeView._provider.rootNode;
            if (source === undefined) {
                return;
            }

            const name = await Vscode.window.showInputBox({ prompt: "Enter a name for the batch", placeHolder: "MyBatch" });
            if (!name) {
                return;
            }

            // We don't support multiple batches with the same name.
            if (source.children.some((node: BatchBuildNode) => {
                return node.name === name;
            })) {
                Vscode.window.showErrorMessage(`Batch with name "${name}" already exists`);
                return;
            }

            source.children.push(new BatchBuildNode(name, NodeType.BatchBuildItem, source, []));

            IarVsc.batchbuildTreeView.syncWithBackend();
        }
    }

    /**
     * Class handling the removal of a batch- or build-item.
     */
    export class RemoveBatchElement extends BatchCommand<BatchBuildNode> {
        constructor() {
            super("iar-build.deleteBatch");
        }

        execute(source: BatchBuildNode | undefined) {
            if (source === undefined || source.parent === undefined) {
                return;
            }

            // Simply get the parent and remove the entry!
            const index = source.parent.children.indexOf(source, 0);
            source.parent.children.splice(index, 1);

            IarVsc.batchbuildTreeView.syncWithBackend();
        }
    }

    class BatchBuildSelection implements Vscode.QuickPickItem {
        readonly label: string;

        constructor(public project: Project, public config: Config) {
            this.label = project.name + ": " + config.name;
        }
    }

    export class AddConfigurationBatch extends BatchCommand<BatchBuildNode> {
        constructor() {
            super("iar-build.addToBatch");
        }

        async execute(source: BatchBuildNode | undefined) {
            if (source === undefined) {
                return;
            }

            const selection: BatchBuildSelection[] = [];

            // Generate the list of available projects and configurations. const availableNodes: BatchBuildNode[] = [];
            for (const project of ExtensionState.getInstance().project.projects) {
                for (const conf of project.configurations) {
                    selection.push(
                        new BatchBuildSelection(project, conf)
                    );
                }
            }

            await Vscode.window.showQuickPick<BatchBuildSelection>(selection, { canPickMany: true, title: "Select configurations to add" }).then(selected => {
                if (selected === undefined) {
                    return;
                }

                for (const item of selected) {
                    // IDE 9.2.2 expands network drives to UNC paths.
                    // This is a bit hacky, but we need to do the same as a client.
                    const ewVersion = ExtensionState.getInstance().workbench.selected?.version;
                    let realProjectPath: string;
                    if (ewVersion?.major === 9 && ewVersion?.minor === 2 && ewVersion.patch === 2) {
                        realProjectPath = Fs.realpathSync.native(item.project.path);
                    } else {
                        realProjectPath = item.project.path;
                    }
                    source.children.push(new BatchBuildItemNode(source, realProjectPath, item.config.name));
                }

                IarVsc.batchbuildTreeView.syncWithBackend();
            });

        }
    }

    export enum TaskNames {
        BuildBatch = "Build batch",
        CleanBatch = "Clean batch",
        RebuildBatch = "Rebuild batch"
    }

    /**
     *  Generic class used for launching the build sequence for a batch. Takes a commandId and a buildcommand
     * that is executed for all listed project-configuration pairs supplied in the specified batch.
     */
    class ExecuteTaskForBatch extends BatchCommand<BatchBuildNode> {

        constructor(commandId: string, private readonly label: TaskNames, private readonly buildcommand: string) {
            super(commandId);
        }

        execute(source: BatchBuildNode | undefined) {
            if (source === undefined) {
                return;
            }

            const contexts: Context[] = [];
            for (const builditem of source.asBatchBuildItem().buildItems) {
                contexts.push({ project: builditem.projectContext.filename, config: builditem.configurationName });
            }

            const definition = {
                label: this.label,
                type: "iar",
                command: this.buildcommand,
                builder: ExtensionState.getInstance().workbench.selected?.builderPath,
                contexts: contexts,
                argumentVariablesFile: "${command:iar-config.argument-variables-file}",
                extraBuildArguments: undefined,
                problemMatcher: ["$iar-cc", "$iar-linker"]
            };


            const buildTask = new Vscode.Task(definition, Vscode.TaskScope.Workspace, this.label, "iar", BuildTasks.getExecution(), ["$iar-cc", "$iar-linker"]);
            Vscode.tasks.executeTask(buildTask);
        }
    }

    export class BuildBatchCommand extends ExecuteTaskForBatch {
        constructor() {
            super("iar-build.buildBatch", TaskNames.BuildBatch, "build");
        }
    }

    export class CleanBatchCommand extends ExecuteTaskForBatch {
        constructor() {
            super("iar-build.cleanBatch", TaskNames.CleanBatch, "clean");
        }
    }

    export class RebuildBatchCommand extends ExecuteTaskForBatch {
        constructor() {
            super("iar-build.rebuildBatch", TaskNames.RebuildBatch, "rebuild");
        }
    }
}