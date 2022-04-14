"use strict"

// Make sure this matches the enum in settingswebview.ts! AFAIK we cannot share code between here and the regular extension
const MessageSubject = {
    WorkbenchSelected: "Workbench",
    ProjectSelected: "Project",
    ConfigSelected: "Config",
    AddWorkbench: "AddWorkbench",
    OpenSettings: "OpenSettings",
}

const vscode = acquireVsCodeApi();

window.addEventListener("load", main);

function connectDropdown(dropdown, messageSubject) {
    dropdown.addEventListener("change", function() {
        vscode.postMessage({ subject: messageSubject, index: dropdown.selectedIndex });
    });
}

function main() {
    connectDropdown(document.getElementById("project"), MessageSubject.ProjectSelected);
    connectDropdown(document.getElementById("config"), MessageSubject.ConfigSelected);

    // The workbench dropdown is special, since the last option allows the user to add a new workbench
    const workbenchDropdown = document.getElementById("workbench");
    workbenchDropdown.addEventListener("change", function() {
        if (workbenchDropdown.selectedIndex === workbenchDropdown.length - 1) {
            vscode.postMessage({ subject: MessageSubject.AddWorkbench, index: 0 });
        } else {
            vscode.postMessage({ subject: MessageSubject.WorkbenchSelected, index: workbenchDropdown.selectedIndex });
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
            target.selectedIndex = message["index"];
            triggerEvent(target, "change");
        }
    });
}

function triggerEvent(elem, eventName) {
    const event = document.createEvent('HTMLEvents');
    event.initEvent(eventName, true, false);
    elem.dispatchEvent(event);
};