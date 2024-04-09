/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import { PathLike } from "fs";
import * as Path from "path";
import * as FsPromises from "fs/promises";
import * as Vscode from "vscode";
import { ChildProcess } from "child_process";
import { ProjectManagerError } from "iar-vsc-common/thrift/bindings/projectmanager_types";
import { OsUtils } from "iar-vsc-common/osUtils";

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
        // First check the user's choice in the UI, if the file is opened
        const textDocument = Vscode.workspace.textDocuments.find(
            doc => OsUtils.pathsEqual(doc.fileName, filePath.toString()));
        if (textDocument) {
            if (textDocument.languageId === "c" || textDocument.languageId === "cpp") {
                return textDocument.languageId;
            }
            return undefined;
        }

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
     * Waits for a process to exit. Returns the exit code of the process.
     */
    export function waitForExitCode(process: ChildProcess): Promise<number | null> {
        return new Promise((resolve, reject) => {
            process.on("exit", code => {
                resolve(code);
            });
            process.on("error", e => reject(e));
        });
    }
    /**
     * Waits for a process to exit. Rejects if the exit code is non-zero.
     */
    export async function waitForExit(process: ChildProcess): Promise<void> {
        const code = await waitForExitCode(process);
        if (code !== 0) {
            throw new Error("Process exited with code: " + code);
        }
    }
}

export namespace BackupUtils {
    export function isBackupFile(project: string): boolean {
        return /^Backup\s+(\(\d+\)\s+)?of.*\.ewp$/.test(Path.basename(project)) ||
            /^.*\s+のバックアップ(\s+\(\d+\))?\.ewp$/.test(Path.basename(project));
    }
    /**
     * Performs a task that might produce a backup of a project file and returns the result of the task.
     * Any backups created while performing the tasks are automatically removed.
     * See IDE-5888: simply loading a project would create a backup identical to the original file. See also VSC-192.
     * @param projects The path to the project(s) that the task uses, i.e. the project(s) to watch for backups of
     * @param task Some task that might produce backup files. After fulfilling, any backup files are removed
     * @returns The result of #{@link task}
     */
    export async function doWithBackupCheck<T>(projects: string | string[], task: () => Promise<T>): Promise<T> {
        const projectList = Array.isArray(projects) ? projects : [projects];

        const checks: Map<string, RegExp[]> = new Map();
        projectList.forEach(project => {
            const projectDir = Path.dirname(project);
            if (!checks.has(projectDir)) {
                checks.set(projectDir, []);
            }
            const projectNameRegex = RegexUtils.escape(Path.basename(project, ".ewp"));
            // match all backup files for the project (.ewp, .ewt, .ewd)
            checks.get(projectDir)?.push(new RegExp(`Backup\\s+(\\(\\d+\\))?\\s*of ${projectNameRegex}\\.ew`));
            checks.get(projectDir)?.push(new RegExp(`${projectNameRegex}\\s+のバックアップ(\\s+\\(\\d+\\))?\\.ew`));
        });

        const findBackupFiles = async() => {
            const backupFiles: Map<string, number> = new Map;
            await Promise.allSettled(
                Array.from(checks.entries()).
                    map(async([projectDir, regexps]) => {
                        const backups = (await FsPromises.readdir(projectDir)).
                            filter(file => regexps.some(regex => file.match(regex))).
                            map(file => Path.join(projectDir, file));
                        await Promise.all(backups.map(async(file) => {
                            const stat = await FsPromises.stat(file);
                            backupFiles.set(file, stat.birthtimeMs);
                        }));
                    })
            );
            return backupFiles;
        };

        const originalBackupFiles = await findBackupFiles();

        const taskPromise = task();
        return taskPromise.finally(async() => {
            const backupFilesAfterExit = await findBackupFiles();
            for (const [file, newBirthTime] of backupFilesAfterExit) {
                // If the birthtime changed, the file was probably deleted by
                // another call to this method running concurrently for the same
                // file, and then recreated by this task. We should delete it.
                if (!originalBackupFiles.has(file) || originalBackupFiles.get(file) !== newBirthTime) {
                    try {
                        await FsPromises.rm(file);
                    } catch {}
                }
            }
        });
    }
}

export namespace RegexUtils {
    /**
     * Escapes a string for use in a regular expression.
     * The returned string will be a regex matching the input string exactly.
     */
    export function escape(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
}

export namespace ErrorUtils {
    /**
     * Converts an unknown error (usually something caught by a try-catch)
     * into an appropriate error string.
     */
    export function toErrorMessage(e: unknown): string {
        if (e instanceof ProjectManagerError) {
            return e.description;
        } else if (e instanceof Error) {
            return e.message;
        } else if (typeof(e) === "string") {
            return e;
        }
        return "unknown error";
    }
}

export namespace Utils {
    /**
     * Type predicate checking that a value is not undefined. Useful for
     * filtering an Array<T | undefined> into an Array<T>.
     */
    export function notUndefined<T>(value: T | undefined): value is T {
        return value !== undefined;
    }
}