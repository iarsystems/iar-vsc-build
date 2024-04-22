/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import { LogEntry, LogSeverity } from "iar-vsc-common/thrift/bindings/logservice_types";
import { IarVsc } from "../main";
import { ExtensionState } from "../extensionstate";
import { logger } from "iar-vsc-common/logger";
import { ThriftServiceHandler } from "iar-vsc-common/thrift/thriftUtils";
import * as LogService from "iar-vsc-common/thrift/bindings/LogService";
import * as Q from "q";

const CMAKE_CMSIS_LOG_CATEGORY = "Log_CMake_CMSIS";
export const CMAKE_CMSIS_LOG_NAME = "CMake/CMSIS-Toolbox";
const BUILD_LOG_CATEGORY = "Log_Build";
const SOURCE_BROWSER_LOG_CATEGORY = "Log_SourceBrowse";

/**
 * Implements the 'logservice' thrift service. This receives log messages from
 * the IDE platform and shows them in VS Code's 'Output' pane. Currently only
 * used by CMake/CMSIS-Toolbox projects, and some warnings when loading
 * projects.
 */
export class LogServiceHandler implements ThriftServiceHandler<LogService.Client> {

    constructor() {
        ExtensionState.getInstance().workspaces.addOnSelectedHandler(() => {
            // See the comment below for why we do this
            if (IarVsc.outputChannelProvider.hasOutputChannel(CMAKE_CMSIS_LOG_CATEGORY)) {
                IarVsc.outputChannelProvider.getOutputChannel(CMAKE_CMSIS_LOG_CATEGORY).clear();
            }
        });
    }

    addCategory(_category: string) {
        // ignored
        return Q.resolve<void>();
    }
    removeCategory(_category: string) {
        // ignored
        return Q.resolve<void>();
    }

    startSession(category: string) {
        // The CMake/CMSIS-Toolbox plugins start a session every time they
        // configure a project, so there may be be several projects in a
        // workspace each logging to their own "session" (at the same time,
        // even). Thus we don't want to clear those logs here. We do it when
        // reloading the workspace instead.
        if (category !== CMAKE_CMSIS_LOG_CATEGORY) {
            this.getLogChannel(category).clear();
        }
        return Q.resolve<void>();
    }

    postLogEntry(entry: LogEntry) {
        if (entry.category === SOURCE_BROWSER_LOG_CATEGORY) {
            // Irrelevant to us
            return Q.resolve<void>();
        } else if (entry.category === BUILD_LOG_CATEGORY) {
            // We supress backups, so logging this would be a lie.
            if (!entry.text.startsWith("Creating backup file for")) {
                // ProjectManagerEngine can log warnings when loading projects,
                // e.g. on missing argvars.
                logger.warn(entry.text);
            }
            return Q.resolve<void>();
        }

        const channel = this.getLogChannel(entry.category);

        switch (entry.severity) {
        case LogSeverity.kDebug:
            channel.trace(entry.text);
            break;
        case LogSeverity.kUser:
            channel.debug(entry.text);
            break;
        case LogSeverity.kMinorInfo:
        case LogSeverity.kInfo:
            channel.info(entry.text);
            break;
        case LogSeverity.kWarning:
            channel.warn(entry.text);
            break;
        case LogSeverity.kError:
        case LogSeverity.kAlert:
            channel.error(entry.text);
            break;
        case LogSeverity.kSuper:
            channel.append(entry.text);
            break;
        }

        if (process.env["log-to-console"]) {
            console.log(`[${entry.category}] ${entry.text}`);
        }

        return Q.resolve<void>();
    }

    private getLogChannel(category: string): Vscode.LogOutputChannel {
        let name = category;
        if (category === CMAKE_CMSIS_LOG_CATEGORY) {
            name = CMAKE_CMSIS_LOG_NAME;
        }
        return IarVsc.outputChannelProvider.getOutputChannel(name);
    }

}