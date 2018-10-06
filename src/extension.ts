'use strict';


import * as vscode from 'vscode';


export function activate(context: vscode.ExtensionContext) {

    let disposable = vscode.commands.registerCommand('extension.syncIarProjectFile', () => {
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
}