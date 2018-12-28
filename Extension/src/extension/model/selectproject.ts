
'use strict';

import { ListInputModelBase } from "./model";
import { Project } from "../../iar/project/project";

export class ProjectListModel extends ListInputModelBase<Project> {
    constructor(...projects: Project[]) {
        super(projects);
    }

    get selectedText(): string | undefined {
        if (this.selected) {
            return this.selected.name;
        } else {
            return undefined;
        }
    }

    get projects(): ReadonlyArray<Project> {
        return this.data;
    }

    label(index: number): string {
        return this.data[index].name;
    }
    description(index: number): string | undefined {
        return this.data[index].path.toString();
    }
    detail(index: number): string | undefined {
        return this.data[index].path.toString();
    }
}
