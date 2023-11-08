/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */


/**
 * An Embedded Workbench project configuration.
 */
export interface Config {
    /** The name of the configuration */
    readonly name: string;
    /** The id of the target this configuration uses (e.g. 'arm'). This is also the name of the target's folder in a
     * workbench installation. */
    readonly targetId: string;
    // readonly toolchainId: string;
}

export namespace Config {
    /**
     * Converts an internal EW toolchain id to a target id (i.e. target folder name).
     */
    export function toolchainIdToTargetId(toolchainId: string) {
        const match = toolchainId.match(/cmake_(.+)/i);
        if (match && match[1]) {
            toolchainId = match[1];
        }
        // Most targets have the same folder name ("target id") and EW-internal name ("toolchain id"), but with the
        // folder name in lowercase. However, some do not.
        return toolchainIdToTargetIdMap[toolchainId.toLowerCase()] ?? toolchainId.toLowerCase();
    }
    const toolchainIdToTargetIdMap: { [toolchainId: string]: string } = {
        "msp430": "430"
    };
}

