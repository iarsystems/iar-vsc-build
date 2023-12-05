/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import { MutableListInputModelBase } from "./model";
import { Config } from "../../iar/project/config";
import { Project } from "../../iar/project/project";
import { Workbench } from "iar-vsc-common/workbench";

export class ConfigurationListModel extends MutableListInputModelBase<Config> {
    constructor(...configs: Config[]) {
        super(configs);
    }

    override itemLabel(item: Config): string {
        return item.name;
    }
    override itemDescription(item: Config): string | undefined {
        return Workbench.getTargetDisplayName(item.targetId);
    }
    override itemDetail(): string | undefined {
        return undefined;
    }

    useConfigurationsFromProject(project?: Project): void {
        let configs: ReadonlyArray<Config> = [];

        if (project) {
            configs = project.configurations;
        }

        this.set(...configs);
    }
}
