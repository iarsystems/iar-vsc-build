/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import { Config } from "./config";
import { Node } from "iar-vsc-common/thrift/bindings/projectmanager_types";
import { OsUtils } from "iar-vsc-common/osUtils";
import { ExtensionSettings } from "../../extension/settings/extensionsettings";
import { BackupUtils } from "../../utils/utils";

/**
 * An embedded workbench project.
 */
export interface Project {
    name: string;
    path: string;
    configurations: ReadonlyArray<Config>;
    findConfiguration(name: string): Config | undefined;

    reload(): void | Promise<void>;

    /**
     * Called when some of the project data is changed (e.g. the names of configurations).
     */
    addOnChangeListener(callback: () => void): void;
    removeOnChangeListener(callback: () => void): void;
}

/**
 * An embedded workbench project that is loaded through e.g. thrift, so we can perform some operations on it.
 */
export interface ExtendedProject extends Project {
    /**
     * Gets the node at the top of the project (file) tree. If no configuration
     * is specified, gets the nodes for an arbitrary configuration. The
     * configuration is mostly relevant for CMake/CMSIS-Toolbox projects, that
     * may have a different set of project files for different configurations.
     */
    getRootNode(config?: Config): Promise<Node>;
    /**
     * Sets a node in the project (file) tree
     * @param node The new value for the node
     * @param indexPath The path to node to replace, as a series of child indices
     */
    setNode(node: Node, indexPath: number[]): Promise<void>;
    /**
     * Gets the directory where C-STAT will place its output files
     */
    getCStatOutputDirectory(config: string): Promise<string | undefined>;
    /**
     * Gets the C-SPY command line used to debug the configuration
     */
    getCSpyArguments(config: string): Promise<string[] | undefined>;

    /**
     * Notify that the project was built and may need to be updated.
     *
     * For cmake and cmsis projects, building may trigger a 'configure' that
     * changes the project content.
     */
    updateAfterBuild(): Promise<void>;

    /**
     * Gets whether the projects is a CMake or CMSIS-Toolbox project (true) or
     * a regular project (false).
     */
    isCmakeOrCmsisProject(): Promise<boolean>;
    /**
     * Only valid for cmake or cmsis projects. Brings the project up-to-date
     * with its input files (CMakeLists.txt or csolution/cproject).
     */
    configure(): Promise<void>;
    /**
     * Only valid for cmake or cmsis projects. Removes previous configure
     * results and reruns it.
     */
    reconfigure(): Promise<void>;
}


export namespace Project {
    /**
     * Checks whether this file should be ignored.
     */
    export function isIgnoredFile(projectFile: string): boolean {
        // Checks whether this is an automatic backup file. These should generally be ignored.
        if (BackupUtils.isBackupFile(projectFile)) {
            return true;
        }

        // All projects that match this regex should be ignored
        const projectsToExclude = ExtensionSettings.getProjectsToExclude();
        const flags = OsUtils.detectOsType() === OsUtils.OsType.Windows ? "i" : undefined;
        let isIgnoredFile = !!projectsToExclude && RegExp(projectsToExclude, flags).test(projectFile);
        // On windows, allow matching against forward slashes too
        if (!isIgnoredFile && OsUtils.detectOsType() === OsUtils.OsType.Windows) {
            const withForwardSlashes = projectFile.replace(/\\/g, "/");
            isIgnoredFile = !!projectsToExclude && RegExp(projectsToExclude, flags).test(withForwardSlashes);
        }

        return isIgnoredFile;
    }

    export function equal(p1: Project, p2: Project) {
        return OsUtils.pathsEqual(p1.path, p2.path) &&
            p1.configurations.length === p2.configurations.length &&
            p1.configurations.every(conf1 => p2.configurations.some(conf2 => Config.equal(conf1, conf2)));
    }
}
