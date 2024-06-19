/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { MessageSubject } from "./messageSubject";

const vscode = acquireVsCodeApi();

window.addEventListener("load", main);

// VSCode webview toolkit components don't inherit from standard HTML element
// types, so we need some custom type checking for dropdown ("select") elements.
type SelectLike = Pick<HTMLSelectElement, "length" | "selectedIndex" | "options">;
function isSelectLike(it: unknown): it is SelectLike {
    return it !== null && typeof(it) === "object" && "options" in it;
}

function connectDropdown(dropdown: HTMLElement | null, subject: MessageSubject) {
    if (isSelectLike(dropdown)) {
        dropdown.addEventListener("change", function() {
            sendDropdownMessage(dropdown, subject);
        });
    }
}

function sendDropdownMessage(dropdown: SelectLike, subject: MessageSubject) {
    let index = dropdown.selectedIndex;
    // Options with the 'artificial' attribute, e.g. "None selected...", should not count toward the model index,
    // only real entries do.
    for (let i = 0; i < dropdown.selectedIndex; i++) {
        if (dropdown.options[i]?.getAttribute("artificial") !== null) {
            index -= 1;
        }
    }
    vscode.postMessage({ subject, index });
}

function main() {
    connectDropdown(document.getElementById("workspace"), MessageSubject.WorkspaceSelected);
    connectDropdown(document.getElementById("project"), MessageSubject.ProjectSelected);
    connectDropdown(document.getElementById("config"), MessageSubject.ConfigSelected);

    // The workbench dropdown is special, since the last option allows the user to add a new workbench
    const workbenchDropdown = document.getElementById("workbench");
    if (isSelectLike(workbenchDropdown)) {
        workbenchDropdown.addEventListener("change", function() {
            if (workbenchDropdown.selectedIndex === workbenchDropdown.length - 1) {
                vscode.postMessage({ subject: MessageSubject.AddWorkbench, index: 0 });
            } else {
                sendDropdownMessage(workbenchDropdown, MessageSubject.WorkbenchSelected);
            }
        });
    }

    const addWorkbenchLink = document.getElementById("link-add");
    addWorkbenchLink?.addEventListener("click", function() {
        vscode.postMessage({ subject: MessageSubject.AddWorkbench, index: 0 });
    });

    const openSettingsLink = document.getElementById("settings-link");
    openSettingsLink?.addEventListener("click", function() {
        vscode.postMessage({ subject: MessageSubject.OpenSettings, index: 0 });
    });

    // For testing purposes. Allows sending messages to select specific entries from dropdowns
    window.addEventListener("message", event => {
        const message = event.data;
        if (message["subject"] === "select") {
            const target = document.getElementById(message["target"]);
            if (!isSelectLike(target)) {
                return;
            }
            let index = message["index"];
            // Options with the 'artificial' attribute, e.g. "None selected...", should not count toward the model index,
            // only real entries do.
            for (let i = 0; i <= index; i++) {
                if (target.options[i]?.getAttribute("artificial") !== null) {
                    index += 1;
                }
            }
            target.selectedIndex = index;
            triggerEvent(target, "change");
        }
    });

    vscode.postMessage({ subject: MessageSubject.ViewLoaded });
}

function triggerEvent(elem: HTMLElement, eventName: string) {
    const event = new Event(eventName, { bubbles: true, cancelable: false });
    elem.dispatchEvent(event);
}