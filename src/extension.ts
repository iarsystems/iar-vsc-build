'use strict';


import * as vscode from 'vscode';
import * as iar from './iar/project'

export function activate(context: vscode.ExtensionContext) {

    let disposable = vscode.commands.registerCommand('extension.syncIarProjectFile', () => {
        let project = new iar.Project('/home/pluyckx/Downloads/iar_project_files/arm/7.40/PD-68VENCON.ewp');

        let ret = project.parse();

        let settings = vscode.workspace.getConfiguration("iarvsc");
        console.log(settings.get("iarRootPaths"));

        if (!ret) {
            project.getConfigs().forEach(element => {
                console.log(element.getName());
                console.log(element.getDefines());
                console.log(element.getIncludePaths());
                console.log(element.getPreIncludes());
                console.log('-----');
            });
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
}