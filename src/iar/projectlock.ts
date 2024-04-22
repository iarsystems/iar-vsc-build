/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { Mutex } from "async-mutex";

/**
 * Loading projects can have side effects on disk (such as writing cache files
 * or performing a CMake configure). Thus, we cannot load the same project in
 * multiple places concurrently (for examply by running iarbuild while a project
 * is being loaded in IarServiceLauncher). This namespace provides a way of
 * locking projects while loading them.
 */
export namespace ProjectLock {
    const locks: Record<string, Mutex> = {};
    const FAILED_TO_LOCK = "FAILED_TO_LOCK";

    /**
     * Run an exclusive task for the given project(s). No other exclusive tasks
     * may run for the project(s) until the task is done.
     */
    export async function runExclusive<T>(filePaths: string | string[], task: () => Promise<T>): Promise<T> {
        if (typeof filePaths === "string") {
            const file = filePaths;
            if (!locks[file]) {
                locks[file] = new Mutex;
            }
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            return locks[file]!.runExclusive(task);
        } else {
            try {
                return await withProjectsRecursive(filePaths, task);
            } catch (e) {
                if (e === FAILED_TO_LOCK) {
                    // Back off and try again (at this point we've released all locks)
                    await new Promise(res => setTimeout(res, 100));
                    return runExclusive(filePaths, task);
                }
                return Promise.reject(e);
            }
        }
    }

    function withProjectsRecursive<T>(filePaths: string[], task: () => Promise<T>): Promise<T> {
        const file = filePaths[0];
        if (file === undefined) {
            return task();
        }

        if (!locks[file]) {
            locks[file] = new Mutex;
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const lock = locks[file]!;
        if (lock.isLocked()) {
            return Promise.reject(FAILED_TO_LOCK);
        }
        return lock.runExclusive(() => withProjectsRecursive(filePaths.slice(1), task));
    }
}