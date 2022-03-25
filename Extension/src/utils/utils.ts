/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import { PathLike } from "fs";
import * as Path from "path";
import * as FsPromises from "fs/promises";
import { ChildProcess } from "child_process";

export namespace ListUtils {
    /**
     * Merge two or more lists. This function will return a list of unique
     * items. Duplicates are removed.
     *
     * @param list Array list containing lists of workbenches
     */
    export function mergeUnique<T>(getKey: (o: T) => string, ...lists: Array<T>[]): T[] {
        const result: Map<string, T> = new Map<string, T>();

        lists.forEach(list => {
            list.forEach(item => {
                result.set(getKey(item), item);
            });
        });

        return Array.from(result.values());
    }
}

export namespace LanguageUtils {
    const cExtensions = [".c", ".h"];
    const cppExtensions = [".cpp", ".hpp", ".cxx", ".hxx", ".cc", ".hh"];


    export type Language = "c" | "cpp";

    export function determineLanguage(filePath: PathLike): Language | undefined {
        const extension = Path.extname(filePath.toString());

        if (cExtensions.includes(extension)) {
            return "c";
        } else if (cppExtensions.includes(extension)) {
            return "cpp";
        } else {
            return undefined;
        }
    }
}

export namespace ProcessUtils {
    /**
     * Waits for a process to exit. Rejects if the exit code is non-zero.
     */
    export function waitForExit(process: ChildProcess) {
        return new Promise<void>((resolve, reject) => {
            process.on("exit", code => {
                if (code !== 0) {
                    reject(new Error("Process exited with code: " + code));
                } else {
                    resolve();
                }
            });
        });
    }
}

export namespace BackupUtils {
    /**
     * Performs a task that might erroneously produce a backup of a project file and returns the result of the task.
     * Any backups created while performing the tasks are automatically removed.
     * See IDE-5888: simply loading a project would create a backup identical to the original file. See also VSC-192.
     * @param project The path to the project that the task uses, i.e. the project to watch for backups of
     * @param task Some task that might produce backup files. After fulfilling, any backup files are removed
     * @returns The result of #{@link task}
     */
    export async function doWithBackupCheck<T>(project: string, task: () => Promise<T>): Promise<T> {
        // TODO: only do this if we detect from the platform version that it is needed
        const projectDir = Path.dirname(project);
        // match all backup files for the project (.ewp, .ewt, .ewd)
        const backupRegex = new RegExp(`Backup\\s+(\\(\\d+\\))?\\s*of ${Path.basename(project, ".ewp")}.ew`);
        const originalBackupFiles = (await FsPromises.readdir(projectDir)).filter(file => file.match(backupRegex));

        const taskPromise = task();
        taskPromise.finally(async() => {
            const backupFilesAfterExit = (await FsPromises.readdir(Path.dirname(project))).filter(file => file.match(backupRegex));
            if (originalBackupFiles.length !== backupFilesAfterExit.length) {
                const newBackupFiles = backupFilesAfterExit.filter(backupFile => !originalBackupFiles.includes(backupFile));
                await Promise.allSettled(newBackupFiles.map(file => FsPromises.rm(Path.join(projectDir, file))));
            }
        });

        return taskPromise;
    }
}