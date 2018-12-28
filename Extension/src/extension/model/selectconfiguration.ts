
'use strict';

import { ListInputModelBase } from "./model";
import { Config } from "../../iar/project/config";
import { Project } from "../../iar/project/project";

export class ConfigurationListModel extends ListInputModelBase<Config> {
    constructor(...configs: Config[]) {
        super(configs);
    }

    get selectedText(): string | undefined {
        if (this.selected) {
            return this.selected.name;
        } else {
            return undefined;
        }
    }

    get configurations(): ReadonlyArray<Config> {
        return this.data;
    }

    label(index: number): string {
        return this.data[index].name;
    }
    description(): string | undefined {
        return undefined;
    }
    detail(): string | undefined {
        return undefined;
    }

    useConfigurationsFromProject(project?: Project): void {
        let configs: ReadonlyArray<Config> = [];

        if (project) {
            configs = project.configurations;
        }

        this.data = configs;
        this.selectedIndex_ = undefined;

        this.fireInvalidateEvent();
        this.fireSelectionChanged();
    }
}
