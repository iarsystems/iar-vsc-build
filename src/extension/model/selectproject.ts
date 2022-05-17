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

    label(index: number): string {
        return this.getProjectAt(index).name;
    }
    description(_index: number): string | undefined {
        return undefined;
    }
    detail(index: number): string | undefined {
        return this.getProjectAt(index).path.toString();
    }

    addProject(project: Project) {
        this.data = this.data.concat([project]);
        this.fireInvalidateEvent();
    }
    removeProject(project: Project) {
        const index = this.data.indexOf(project);
        if (index !== -1) {
            this.data.splice(index, 1);
            this.fireInvalidateEvent();
        }
    }

    private getProjectAt(index: number): Project {
        const result = this.data[index];
        if (result === undefined) {
            throw new Error(`No project with index ${index}`);
        }
        return result;
    }
}
