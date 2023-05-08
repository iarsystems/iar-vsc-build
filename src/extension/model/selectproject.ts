/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import { ListInputModelBase } from "./model";
import { Project } from "../../iar/project/project";

export class ProjectListModel extends ListInputModelBase<Project> {
    constructor(...projects: Project[]) {
        super(projects);
    }

    get projects(): ReadonlyArray<Project> {
        return this.data;
    }

    override itemLabel(item: Project): string {
        return item.name;
    }
    override itemDescription(_item: Project): string | undefined {
        return undefined;
    }
    override itemDetail(item: Project): string | undefined {
        return item.path;
    }

    addProject(project: Project) {
        this.data = this.data.concat([project]);
        this.fireInvalidateEvent();
    }
}
