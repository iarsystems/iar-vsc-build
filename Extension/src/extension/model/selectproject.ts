/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

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

    addProject(project: Project) {
        this.data = this.data.concat([project]);
        this.fireInvalidateEvent();
    }
}
