/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as vscode from "vscode";
import { Config } from "../project/config";
import { ExtendedProject, Project } from "../project/project";
import { EwwFile } from "./ewwfile";
import { EwpFile } from "../project/parsing/ewpfile";
import { LocalSettings } from "../../extension/settings/localsettings";
import { ProjectListModel } from "../../extension/model/selectproject";
import { OsUtils } from "iar-vsc-common/osUtils";
import { ConfigurationListModel } from "../../extension/model/selectconfiguration";
import { logger } from "iar-vsc-common/logger";
import { ErrorUtils, Utils } from "../../utils/utils";
import { BatchBuildItem } from "iar-vsc-common/thrift/bindings/projectmanager_types";

/**
 * An Embedded Workbench workspace. This is unrelated to VS Code's
 * workspace concept.
 *
 * This is similar to the IDE's PmWorkspace/PgWorkspace; it owns a set of
 * projects, and keeps track of which project configuration to use for each
 * project.
 */
export class EwWorkspace {

    readonly name: string | undefined;
    readonly path: string | undefined;

    readonly projects: ProjectListModel;
    // Convenience view of the configs of the active project (i.e. this.projects.selected)
    readonly projectConfigs  = new ConfigurationListModel;

    private readonly activeConfigurations: Map<Project, Config> = new Map;
    private readonly activeConfigurationListeners:
        Array<(proj: Project, conf: Config | undefined) => void> = [];

    constructor(private readonly workspaceFile: EwwFile | undefined, projects: Project[]) {
        this.name = workspaceFile?.name;
        this.path = workspaceFile?.path;

        this.projects = new ProjectListModel(...projects);
        for (const project of projects) {
            const storedConfigName = LocalSettings.getSelectedConfiguration(this.workspaceFile, project);
            const storedConfig = project.configurations.find(conf => conf.name === storedConfigName);
            const newActiveConfig = storedConfig ?? project.configurations[0];
            if (newActiveConfig) {
                this.activeConfigurations.set(project, newActiveConfig);
            }
        }

        this.projects.addOnSelectedHandler(() => {
            this.projectConfigs.set(...(this.projects.selected?.configurations) ?? []);
            if (this.projects.selected) {
                LocalSettings.setSelectedProject(this.workspaceFile, this.projects.selected);

                const activeConfig = this.getActiveConfig(this.projects.selected);
                if (activeConfig) {
                    this.projectConfigs.selectWhen(c => c.name === activeConfig.name);
                }
            }
        });

        projects.forEach(project => project.addOnChangeListener(() => {
            if (project === this.projects.selected) {
                this.projectConfigs.set(...project.configurations);
            }

            const prevActiveConfig = this.activeConfigurations.get(project);
            let newActiveConfig = prevActiveConfig;
            if (!prevActiveConfig || !project.findConfiguration(prevActiveConfig.name)) {
                newActiveConfig = project.configurations[0];
            }
            this.setActiveConfig(newActiveConfig);
        }));

        const storedProjPath = LocalSettings.getSelectedProject(this.workspaceFile);
        if (storedProjPath) {
            this.projects.selectWhen(proj => OsUtils.pathsEqual(storedProjPath, proj.path));
        }
        if (!this.projects.selected) {
            this.projects.select(0);
        }
    }

    /**
     * Sets the configuration to use for some project (e.g. for intellisense).
     * If no project is specified, sets the config for the active project.
     */
    setActiveConfig(config: Config | undefined, project?: Project) {
        if (project && !this.projects.items.includes(project)) {
            throw new Error("Trying to set active config for an unknown project");
        }
        project ??= this.projects.selected;

        if (project) {
            if (config) {
                this.activeConfigurations.set(project, config);
                LocalSettings.setSelectedConfiguration(this.workspaceFile, project, config);

                if (project === this.projects.selected) {
                    this.projectConfigs.selectWhen(c => c.name === config.name);
                }
            } else {
                this.activeConfigurations.delete(project);
            }

            for (const callback of this.activeConfigurationListeners) {
                callback(project, config);
            }
        }
    }
    /**
     * Gets the configuration to use for some project (e.g. for intellisense).
     * If no project is specified, gets the config for the active project.
     */
    getActiveConfig(project?: Project): Config | undefined {
        project ??= this.projects.selected;
        if (project) {
            return this.activeConfigurations.get(project);
        }
        return undefined;
    }
    onActiveConfigChanged(callback: (proj: Project, conf: Config | undefined) => void) {
        this.activeConfigurationListeners.push(callback);
    }

    /**
     * Some functionality is only available on newer workbenches (that support
     * the thrift project manager). Use this to check for availability.
     */
    isExtendedWorkspace(): this is ExtendedEwWorkspace {
        return this instanceof ExtendedEwWorkspace;
    }
    asExtendedWorkspace(): ExtendedEwWorkspace | undefined {
        if (this.isExtendedWorkspace()) {
            return this;
        }
        return undefined;
    }
}

/**
 * A workspace with additional functionality provided by newer workbenches that
 * support the thrift project manager.
 */
export abstract class ExtendedEwWorkspace extends EwWorkspace {

    /**
     * Gets an version of a workspace project with extended functionality,
     * loading it if needed.
     * Defaults to the active project.
     * Returns undefined on failure.
     */
    abstract getExtendedProject(project?: Project): Promise<ExtendedProject | undefined>;

    /**
     * Get the list of batches that can be built. Eatch item consits of a name BatchBuildItem with
     * a vector of BuildItems which con
    */
    abstract getBatchBuilds(): Promise<BatchBuildItem[] | undefined>;

    /**
     * Transfer the set of batchbuild items to the backend.
     * @param items The set of batchbuild items to transfer.
     */
    abstract setBatchBuilds(items: BatchBuildItem[]): Promise<void>;
}


/**
 * A strictly file/xml-based workspace implementation. This is a fallback for
 * when we can't use a thrift-based workspace (e.g. because of an old workbench).
 */
export class SimpleWorkspace extends EwWorkspace {

    static async fromEwwFile(workspaceFile: EwwFile) {
        const projects = await EwwFile.getMemberProjects(workspaceFile.path);
        return new SimpleWorkspace(projects, workspaceFile);
    }
    static fromProjectPaths(projects: string[]) {
        return new SimpleWorkspace(projects);
    }

    private constructor(projects: string[], workspaceFile?: EwwFile) {
        super(
            workspaceFile,
            projects.map(proj => {
                try {
                    return new EwpFile(proj);
                } catch (e) {
                    const errMsg = ErrorUtils.toErrorMessage(e);
                    logger.error(`Could not parse project file '${proj}': ${errMsg}`);
                    vscode.window.showErrorMessage(
                        `Could not parse project file '${proj}': ${errMsg}`
                    );
                    return undefined;
                }
            }).filter(Utils.notUndefined)
        );
    }
}


