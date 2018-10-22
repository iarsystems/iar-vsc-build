'use strict';


import * as vscode from 'vscode';
import * as iar from './iar/project';
import { join } from 'path';
import { CCppPropertiesFile } from './vsc/c_cpp_properties';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {

    let disposable = vscode.commands.registerCommand('extension.syncIarProjectFile', () => {
        let project = new iar.Project('/home/pluyckx/Downloads/iar_project_files/arm/7.40/PD-68VENCON.ewp');

        let ret = project.parse();

        let settings = vscode.workspace.getConfiguration("iarvsc");
        console.log(settings.get("iarRootPaths"));

        if (!ret) {
            let wsFolder = vscode.workspace.rootPath;

            if(!wsFolder) {
                return;
            }

            let propertyFileDir = join(wsFolder, ".vscode");

            if(fs.existsSync(propertyFileDir)) {
                let stat = fs.statSync(propertyFileDir);

                if(!stat.isDirectory()) {
                    return;
                }
            } else {
                fs.mkdirSync(propertyFileDir);
            }

            let propertyFilePath = join(propertyFileDir, "c_cpp_properties.json");
            let prop: CCppPropertiesFile = new CCppPropertiesFile();

            if(fs.existsSync(propertyFilePath)) {
                fs.copyFileSync(propertyFilePath, propertyFilePath + ".back");

                prop.load(propertyFilePath);
            }

            project.getConfigs().forEach(config => {
                prop.setConfiguration(config);
            });

            prop.write(propertyFilePath);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
}
