/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { logger } from "iar-vsc-common/logger";
import { OsUtils } from "iar-vsc-common/osUtils";
import * as vscode from "vscode";

/**
 * Watches the VS Code workspace folder(s) to keep an up-to-date list of
 * all files matching some glob pattern. See {@link subscribe} to
 * get notified of file changes.
 */
export class FileListWatcher implements vscode.Disposable {
    private readonly watcher: vscode.FileSystemWatcher;
    private subscriptions: vscode.Disposable[] = [];

    private readonly filesCallbacks: Array<(files: ReadonlyArray<string>) => void> = [];
    private readonly fileModifiedCallbacks: Array<(file: string) => void> = [];

    static async initialize(
        glob: string,
    ): Promise<FileListWatcher> {
        const files = (await vscode.workspace.findFiles(glob)).map(uri => uri.fsPath);
        return new FileListWatcher(glob, files);
    }

    async refreshFiles() {
        const foundFiles = (await vscode.workspace.findFiles(this.glob)).map(uri => uri.fsPath);
        this.setFiles(foundFiles);
    }

    /**
     * Registers a function to be called when the list of matching files changes.
     * The function is also immediately called with the current files.
     */
    subscribe(callback: (files: ReadonlyArray<string>) => void) {
        this.filesCallbacks.push(callback);
        callback(this.data);
    }

    /**
     * Registers a function to be called when a matching file is modified.
     */
    onFileModified(callback: (file: string) => void) {
        this.fileModifiedCallbacks.push(callback);
    }

    private setFiles(newData: string[]) {
        this.data = newData;
        this.filesCallbacks.forEach(handler => handler(this.data));
    }

    private constructor(
        private readonly glob: string,
        private data: ReadonlyArray<string>,
    ) {
        this.watcher = vscode.workspace.createFileSystemWatcher(glob);
        this.subscriptions.push(this.watcher);

        this.watcher.onDidCreate(path => {
            logger.debug("Detected new file: " + path.fsPath);
            this.setFiles(this.data.concat([path.fsPath]));
        });

        this.watcher.onDidDelete(path => {
            const keptFiles = this.data.filter(file => !OsUtils.pathsEqual(file, path.fsPath));
            if (keptFiles.length !== this.data.length) {
                logger.debug("Detected deleted file: " + path.fsPath);
                this.setFiles(keptFiles);
            }
        });

        this.watcher.onDidChange(path => {
            this.fileModifiedCallbacks.forEach(callback => callback(path.fsPath));
        });

        this.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(() => this.refreshFiles()));
    }

    dispose() {
        this.subscriptions.forEach(s => s.dispose());
        this.subscriptions = [];
    }
}
