/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Config } from "./config";
import { Project } from "./project";

/**
 * A project that redirects all calls to another, real project instance. The
 * underlying project can be replaced at any time. This is useful for creating
 * placeholder projects from {@link EwpFile} that can be replaced by a
 * {@link ThriftProject} if one is loaded.
 */
export class ProjectHolder implements Project {
    private readonly onChangeHandlers: (() => void)[] = [];
    private readonly onTargetChanged = this.fireChangedEvent.bind(this);

    constructor(private target: Project) {}

    get name() {
        return this.target.name;
    }
    get path() {
        return this.target.path;
    }
    get configurations(): readonly Config[] {
        return this.target.configurations;
    }

    setProject(target: Project) {
        this.target.removeOnChangeListener(this.onTargetChanged);
        this.target = target;
        target.addOnChangeListener(this.onTargetChanged);
        this.fireChangedEvent();
    }

    findConfiguration(name: string): Config | undefined {
        return this.target.findConfiguration(name);
    }
    reload(): void | Promise<void> {
        return this.target.reload();
    }
    addOnChangeListener(callback: () => void): void {
        this.onChangeHandlers.push(callback);
    }
    removeOnChangeListener(callback: () => void): void {
        const idx = this.onChangeHandlers.indexOf(callback);
        if (idx !== -1) {
            this.onChangeHandlers.splice(idx, 1);
        }
    }

    private fireChangedEvent() {
        this.onChangeHandlers.forEach(handler => handler());
    }
}
