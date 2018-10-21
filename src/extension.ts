'use strict';


import * as vscode from 'vscode';
import * as iar from './iar/project';
import { Define } from './iar/define';
import { IncludePath } from './iar/includepaths';
import { PreIncludePath } from './iar/preincludepath';

export function activate(context: vscode.ExtensionContext) {

    let disposable = vscode.commands.registerCommand('extension.syncIarProjectFile', () => {
        let project = new iar.Project('/home/pluyckx/Downloads/iar_project_files/arm/7.40/PD-68VENCON.ewp');

        let ret = project.parse();

        let settings = vscode.workspace.getConfiguration("iarvsc");
        console.log(settings.get("iarRootPaths"));

        if (!ret) {
            project.getConfigs().forEach(element => {
                console.log(element.getName());
                printDefines(element.getDefines());
                printIncludePaths(element.getIncludePaths());
                printPreIncludePaths(element.getPreIncludes());
                console.log('-----');
            });
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
}

function printDefines(defines: Define[]) {
    defines.forEach(define => {
        console.log(define.get());
    });
}

function printIncludePaths(includePaths: IncludePath[]) {
    includePaths.forEach(includePath => {
        console.log(includePath.get());
        console.log(includePath.getAbsolute());
    });
}

function printPreIncludePaths(paths: PreIncludePath[]) {
    paths.forEach(path => {
        console.log(path.get());
        console.log(path.getAbsolute());
    });
}
