"use strict"

// Make sure this matches the enum in settingswebview.ts! AFAIK we cannot share code between here and the regular extension
const MessageSubject = {
    WorkbenchSelected: "Workbench",
    ProjectSelected: "Project",
    ConfigSelected: "Config",
    ArgVarsSelected: "ArgVars",
    AddWorkbench: "AddWorkbench",
    OpenSettings: "OpenSettings",
    ViewLoaded: "ViewLoaded",
}

const vscode = acquireVsCodeApi();

window.addEventListener("load", main);

function connectDropdown(dropdown, messageSubject) {
    dropdown.addEventListener("change", function() {
        sendDropdownMessage(dropdown, messageSubject);
    });
}

function sendDropdownMessage(dropdown, subject) {
    let index = dropdown.selectedIndex;
    // Options with the 'artificial' attribute, e.g. "None selected...", should not count toward the model index,
    // only real entries do.
    for (let i = 0; i < dropdown.selectedIndex; i++) {
        if (dropdown.options[i].getAttribute("artificial") !== null) {
            index -= 1;
        }
    }
    vscode.postMessage({ subject, index });
}

function main() {
    connectDropdown(document.getElementById("project"), MessageSubject.ProjectSelected);
    connectDropdown(document.getElementById("config"), MessageSubject.ConfigSelected);
    connectDropdown(document.getElementById("argvarsfile"), MessageSubject.ArgVarsSelected);

    // The workbench dropdown is special, since the last option allows the user to add a new workbench
    const workbenchDropdown = document.getElementById("workbench");
    workbenchDropdown.addEventListener("change", function() {
        if (workbenchDropdown.selectedIndex === workbenchDropdown.length - 1) {
            vscode.postMessage({ subject: MessageSubject.AddWorkbench, index: 0 });
        } else {
            sendDropdownMessage(workbenchDropdown, MessageSubject.WorkbenchSelected);
        }
    });

    const addWorkbenchLink = document.getElementById("link-add");
    addWorkbenchLink.addEventListener("click", function() {
        vscode.postMessage({ subject: MessageSubject.AddWorkbench, index: 0 });
    });

    const openSettingsLink = document.getElementById("settings-link");
    openSettingsLink.addEventListener("click", function() {
        vscode.postMessage({ subject: MessageSubject.OpenSettings, index: 0 });
    });

    // For testing purposes. Allows sending messages to select specific entries from dropdowns
    window.addEventListener("message", event => {
        const message = event.data;
        if (message["subject"] === "select") {
            const target = document.getElementById(message["target"]);
            let index = message["index"];
            // Options with the 'artificial' attribute, e.g. "None selected...", should not count toward the model index,
            // only real entries do.
            for (let i = 0; i <= index; i++) {
                if (target.options[i].getAttribute("artificial") !== null) {
                    index += 1;
                }
            }
            target.selectedIndex = index;
            triggerEvent(target, "change");
        }
    });

    vscode.postMessage({ subject: MessageSubject.ViewLoaded });
}

function triggerEvent(elem, eventName) {
    const event = document.createEvent('HTMLEvents');
    event.initEvent(eventName, true, false);
    elem.dispatchEvent(event);
};