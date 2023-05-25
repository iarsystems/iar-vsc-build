/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as vscode from "vscode";
import { logger } from "iar-vsc-common/logger";

interface TaskItem<T> {
    id: T,
    promise: Promise<unknown>,
    cancelToken: vscode.CancellationTokenSource,
}

/**
 * Processes a series of tasks in order.
 */
export class TaskQueue<T> {
    private readonly queue: Array<TaskItem<T>> = [];

    /**
     * Adds a task to run, resolving when the task has completed.
     */
    pushTask<U>(id: T, task: () => Promise<U>): Promise<U> {
        const cancelTokenSource = new vscode.CancellationTokenSource();

        const prevPromise = this.queue[this.queue.length - 1]?.promise ??
            Promise.resolve();
        const preamble = prevPromise.then(() => {
            if (cancelTokenSource.token.isCancellationRequested) {
                // console.log(`Canceled: ${JSON.stringify(id)}`);
                throw new Error("Task canceled");
            }
            if (this.queue.shift()?.id !== id) {
                logger.error(`Handling task that is not first in line, this should never happen!`);
            }
        });
        const taskPromise = preamble.then(task);

        this.queue.push({
            id,
            promise: taskPromise.catch(() => { /* swallow canceled tasks & errors */ }),
            cancelToken: cancelTokenSource,
        });

        return taskPromise;
    }

    /**
     * Cancels tasks from the end of the queue until the predicate returns false.

     * Note: there is no guarantee that canceled tasks won't run.
     */
    cancelWhile(predicate: (id: T) => boolean) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        while (this.queue.length > 0 && predicate(this.queue[this.queue.length - 1]!.id)) {
            this.queue.pop()?.cancelToken.cancel();
        }
    }

    cancelAll() {
        this.cancelWhile(() => true);
    }
}
