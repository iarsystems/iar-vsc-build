/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { logger } from "iar-vsc-common/logger";
import * as Vscode from "vscode";
import * as Fs from "fs/promises";
import * as Path from "path";
import { createHash } from "crypto";

interface FileStatus {
    path: string,
    hash: string,
}

/**
 * Watches the VS Code workspace folder(s) to keep an up-to-date list of
 * all files matching some glob pattern. See {@link subscribe} to
 * get notified of file changes.
 */
export class FileListWatcher implements Vscode.Disposable {
    private readonly watcher: Vscode.FileSystemWatcher;
    private subscriptions: Vscode.Disposable[] = [];

    private readonly filesCallbacks: Array<(files: ReadonlyArray<string>) => void> = [];
    private readonly fileModifiedCallbacks: Array<(file: string) => void> = [];

    private readonly supressedFileOperations = new Map<string, RefList>();

    static async initialize(
        glob: string,
    ): Promise<FileListWatcher> {
        const files = (await Vscode.workspace.findFiles(glob)).map(uri => uri.fsPath);
        const entries = await this.readFileEntries(files);
        return new FileListWatcher(glob, entries);
    }

    private static async readFileEntry(path: string): Promise<FileStatus> {
        const contents = await Fs.readFile(path);
        return {
            path: Path.normalize(path),
            hash: createHash("md5").update(contents).digest("hex"),
        };
    }
    private static async readFileEntries(files: string[]): Promise<FileStatus[]> {
        return (await Promise.allSettled(files.map(this.readFileEntry))).
            reduce((acc, result) => {
                if (result.status === "fulfilled") {
                    acc.push(result.value);
                }
                return acc;
            }, [] as FileStatus[]);
    }

    async refreshFiles() {
        const foundFiles = (await Vscode.workspace.findFiles(this.glob)).map(uri => uri.fsPath);
        const entries = await FileListWatcher.readFileEntries(foundFiles);
        this.setFiles(entries);
    }

    /**
     * Registers a function to be called when the list of matching files changes.
     * The function is also immediately called with the current files.
     */
    subscribe(callback: (files: ReadonlyArray<string>) => void) {
        this.filesCallbacks.push(callback);
        callback(this.data.map(entry => entry.path));
    }

    /**
     * Registers a function to be called when a matching file is modified.
     */
    onFileModified(callback: (file: string) => void) {
        this.fileModifiedCallbacks.push(callback);
    }

    /**
     * Prevents the next modification of the given file from being detected.
     */
    supressNextFileModificationFor(path: string) {
        const normalizedPath = Path.normalize(path);
        if (!this.supressedFileOperations.has(normalizedPath)) {
            this.supressedFileOperations.set(normalizedPath, new RefList());
        }
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const ref = this.supressedFileOperations.get(normalizedPath)!.push();
        // Just in case the file isn't then modified
        setTimeout(() => this.supressedFileOperations.get(normalizedPath)?.remove(ref), 2000);
    }

    private setFiles(newData: FileStatus[]) {
        this.data = newData;

        const paths = this.data.map(entry => entry.path);
        this.filesCallbacks.forEach(handler => handler(paths));
    }

    private constructor(
        private readonly glob: string,
        private data: ReadonlyArray<FileStatus>,
    ) {
        this.watcher = Vscode.workspace.createFileSystemWatcher(glob);
        this.subscriptions.push(this.watcher);

        this.watcher.onDidCreate(async path => {
            logger.debug("Detected new file: " + path.fsPath);
            const entry = await FileListWatcher.readFileEntry(path.fsPath);
            this.setFiles(this.data.concat([entry]));
        });

        this.watcher.onDidDelete(path => {
            const normalizedPath = Path.normalize(path.fsPath);
            const keptFiles = this.data.filter(file => file.path !== normalizedPath);
            if (keptFiles.length !== this.data.length) {
                logger.debug("Detected deleted file: " + normalizedPath);
                this.setFiles(keptFiles);
            }
        });

        this.watcher.onDidChange(async path => {
            const normalizedPath = Path.normalize(path.fsPath);
            if (this.supressedFileOperations.get(normalizedPath)?.pop()) {
                return;
            }

            const oldEntry = this.data.find(entry => entry.path === normalizedPath);
            if (oldEntry) {
                const newEntry = await FileListWatcher.readFileEntry(path.fsPath);
                if (newEntry.hash !== oldEntry.hash) {
                    logger.debug("Detected modified file: " + normalizedPath);
                    oldEntry.hash = newEntry.hash;
                    this.fileModifiedCallbacks.forEach(callback => callback(normalizedPath));
                }
            }
        });

        this.subscriptions.push(Vscode.workspace.onDidChangeWorkspaceFolders(() => this.refreshFiles()));
    }

    dispose() {
        this.subscriptions.forEach(s => s.dispose());
        this.subscriptions = [];
    }

}

/**
 * A queue-like list of references (numbers).
 * Used here to keep track of expected file operations.
 */
class RefList {
    private readonly refs: number[] = [];

    public push(): number {
        const ref = Math.random();
        this.refs.push(ref);
        return ref;
    }

    public pop(): boolean {
        return this.refs.shift() !== undefined;
    }

    public remove(ref: number) {
        const index = this.refs.indexOf(ref);
        if (index >= 0) {
            this.refs.splice(index, 1);
        }
    }
}