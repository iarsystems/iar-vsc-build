'use strict';


import * as vscode from 'vscode';
import { ExtensionManager } from './extensionmanager';

export function activate(context: vscode.ExtensionContext) {
    let extensionManager = new ExtensionManager();

    context.subscriptions.push(vscode.commands.registerCommand('extension.syncIarProjectFile', () => {
        let ret = extensionManager.generateCCppPropertiesFile();

        if (ret !== undefined) {
            vscode.window.showErrorMessage(ret.message);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('extension.selectIarInstallation', () => {
        let installations = extensionManager.findIarInstallations();

        if(installations.length > 0) {
            let items: string[] = [];

            installations.forEach(installation => {
                items.push("Platform: " + installation.getIarPlatform() + " Version: " + installation.getIarVersion() + " " + installation.getLocation());
            });

            vscode.window.showQuickPick(items).then(value => {
                if(value) {
                    let idx = items.indexOf(value);
                    let installation = installations[idx];

                    extensionManager.setIarLocation(installation.getLocation());
                }
            });
        } else {
            vscode.window.showErrorMessage("No valid IAR installations found.");
        }
    }));
}

export function deactivate() {
}
