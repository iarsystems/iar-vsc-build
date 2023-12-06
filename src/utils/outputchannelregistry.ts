/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import { Disposable } from "vscode";

/**
 * Manages VS Code output channels, making sure there's only one channel with
 * any given name, and allowing disposing them all when deactivating the
 * extension.
 */
export class OutputChannelRegistry implements Disposable {
    private readonly outputChannels: Map<string, Vscode.LogOutputChannel> = new Map;

    hasOutputChannel(name: string): boolean {
        return this.outputChannels.has(name);
    }

    getOutputChannel(name: string): Vscode.LogOutputChannel {
        const channel = this.outputChannels.get(name);
        if (channel) {
            return channel;
        }
        const newChannel = Vscode.window.createOutputChannel(name, { log: true });
        this.outputChannels.set(name, newChannel);
        return newChannel;
    }

    dispose(): void | Promise<void> {
        for (const channel of this.outputChannels.values()) {
            channel.dispose();
        }
        this.outputChannels.clear();
    }
}
