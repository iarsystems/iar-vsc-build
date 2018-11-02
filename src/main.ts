'use strict';


import * as vscode from 'vscode';
import * as path from 'path';
import { ExtensionManager } from './extensionmanager';

export function activate(context: vscode.ExtensionContext) {
    let extensionManager = new ExtensionManager();

    context.subscriptions.push(vscode.commands.registerCommand('iar.syncIarProjectFile', () => {
        let ret = extensionManager.generateCCppPropertiesFile();

        if (ret !== undefined) {
            vscode.window.showErrorMessage(ret.message);
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('iar.selectIarInstallation', () => {
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

    context.subscriptions.push(vscode.commands.registerCommand("iar.selectIarProject", () => {
        let projectFiles = extensionManager.findIarProjectFiles();

        if(projectFiles.length > 0) {
            let items: string[] = [];

            projectFiles.forEach(projectFile => {
                let filename = path.basename(projectFile.toString());

                items.push(filename);
            });

            vscode.window.showQuickPick(items).then(value => {
                if(value) {
                    let idx = items.indexOf(value);
                    let projectFile = projectFiles[idx];

                    extensionManager.setIarProjectPath(projectFile.toString());
                }
            });
        } else {
            vscode.window.showErrorMessage("No IAR projects found in workspace.");
        }
    }));

    context.subscriptions.push(vscode.commands.registerCommand('iar.buildIarProject', () => {
        extensionManager.build(false);
    }));

    context.subscriptions.push(vscode.commands.registerCommand('iar.rebuildIarProject', () => {
        extensionManager.build(true);
    }));
}

export function deactivate() {
}
