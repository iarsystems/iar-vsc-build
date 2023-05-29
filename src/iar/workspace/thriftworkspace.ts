/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { EwWorkspaceBase, ExtendedEwWorkspace } from "./ewworkspace";
import * as ProjectManager from "iar-vsc-common/thrift/bindings/ProjectManager";
import { BatchBuildItem } from "iar-vsc-common/thrift/bindings/projectmanager_types";
import { WorkbenchFeatures } from "iar-vsc-common/workbenchfeatureregistry";
import { Workbench } from "iar-vsc-common/workbench";
import { IarVsc } from "../../extension/main";

export class ThriftWorkspace extends EwWorkspaceBase implements ExtendedEwWorkspace {

    static async fromService(owner: Workbench, projectMgr: ProjectManager.Client, path: string): Promise<ThriftWorkspace> {
        const projectContexts = await projectMgr.GetProjects();
        const projectPaths = projectContexts.map(context => context.filename);
        return new ThriftWorkspace(path, projectPaths, owner, projectMgr);
    }

    private constructor(
        readonly path: string,
        readonly projects: string[],
        private readonly owner: Workbench,
        private readonly projectMgr: ProjectManager.Client,
    ) {
        super();
    }


    public override async getBatchBuilds(): Promise<BatchBuildItem[] | undefined> {
        if (!WorkbenchFeatures.supportsFeature(this.owner, WorkbenchFeatures.PMWorkspaces)) {
            throw new Error("Tried to load batch builds with unsupported toolchain");
        }

        const items = await this.projectMgr.GetBatchBuildItems();
        return items;
    }

    public override async setBatchBuilds(items: BatchBuildItem[]): Promise<BatchBuildItem[] | undefined> {
        if (!WorkbenchFeatures.supportsFeature(this.owner, WorkbenchFeatures.PMWorkspaces)) {
            throw new Error("Tried to set batch builds with unsupported toolchain");
        }
        this.projectMgr.SetBatchBuildItems(items);
        IarVsc.ewwWatcher?.supressNextFileModificationFor(this.path);
        this.projectMgr.SaveEwwFile();
        const state = await this.projectMgr.GetBatchBuildItems();
        return state;
    }


}