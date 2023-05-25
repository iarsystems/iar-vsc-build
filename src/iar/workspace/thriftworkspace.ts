/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { EwWorkspaceBase, ExtendedEwWorkspace } from "./ewworkspace";
import * as ProjectManager from "iar-vsc-common/thrift/bindings/ProjectManager";

export class ThriftWorkspace extends EwWorkspaceBase implements ExtendedEwWorkspace {

    static async fromService(projectMgr: ProjectManager.Client, path: string): Promise<ThriftWorkspace> {
        const projectContexts = await projectMgr.GetProjects();
        const projectPaths = projectContexts.map(context => context.filename);
        return new ThriftWorkspace(path, projectPaths);
        // return new ThriftWorkspace(path, projectPaths, projectMgr);
    }

    private constructor(
        readonly path: string,
        readonly projects: string[],
        // private readonly projectMgr: ProjectManager.Client,
    ) {
        super();
    }

}