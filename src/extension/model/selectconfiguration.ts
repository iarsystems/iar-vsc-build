/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import { ListInputModelBase } from "./model";
import { Config } from "../../iar/project/config";
import { Project } from "../../iar/project/project";
import { Workbench } from "iar-vsc-common/workbench";

export class ConfigurationListModel extends ListInputModelBase<Config> {
    constructor(...configs: Config[]) {
        super(configs);
    }

    get configurations(): ReadonlyArray<Config> {
        return this.data;
    }

    label(index: number): string {
        return this.getConfigurationAt(index).name;
    }
    description(index: number): string | undefined {
        return Workbench.getTargetDisplayName(this.getConfigurationAt(index).targetId);
    }
    detail(): string | undefined {
        return undefined;
    }

    useConfigurationsFromProject(project?: Project): void {
        let configs: ReadonlyArray<Config> = [];

        if (project) {
            configs = project.configurations;
        }

        this.set(...configs);
    }

    private getConfigurationAt(index: number): Config {
        const result = this.data[index];
        if (result === undefined) {
            throw new Error(`No configuration with index ${index}`);
        }
        return result;
    }
}
