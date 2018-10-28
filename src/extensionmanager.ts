
import * as vscode from 'vscode';

import * as fs from 'fs';
import * as path from 'path';

import { Project } from "./iar/project";
import { CCppPropertiesFile } from './vsc/c_cpp_properties';
import { sErrorNoProjectFileSpecified, sErrorNoVsWorkspaceOpened, sErrorNotADirectory, sErrorNotAnIarInstallationFolder } from './iar/errors';
import { Settings } from './extension/settings';
import { IarInstallation } from './iar/iar';

export class ExtensionManager {
    private project: Project | undefined;
    private settings: Settings;
    private iar: IarInstallation | undefined;

    constructor() {
        this.settings = new Settings();

        this.init();
    }

    public init(): void {
        this.settings.load();

        if(this.settings.ewpLocation !== undefined) {
            let ret = this.setIarProjectPath(this.settings.ewpLocation);

            if(ret !== undefined) {
                vscode.window.showErrorMessage(ret.message);
            }
        }

        if(this.settings.iarLocation !== undefined) {
            let ret = this.setIarLocation(this.settings.iarLocation);

            if(ret !== undefined) {
                vscode.window.showErrorMessage(ret.message);
            }
        }
    }

    public setIarLocation(path: fs.PathLike): Error | undefined {
        let iar = new IarInstallation(path);

        if(iar.isValidInstallation()) {
            this.iar = iar;
            return undefined;
        } else {
            return Error(sErrorNotAnIarInstallationFolder);
        }
    }

    public setIarProjectPath(filename: string): Error | undefined {
        let project = new Project(filename);

        let ret = project.parse();

        if(ret === undefined) {
            this.project = project;
        }

        return ret;
    }

    public findIarInstallations(): IarInstallation[] {
        let installations: IarInstallation[] = [];

        let settings = vscode.workspace.getConfiguration("iarvsc");
        let iarRootPaths: string[] | undefined = settings.get('iarRootPaths');

        if(iarRootPaths) {
            iarRootPaths.forEach(root => {
                installations = installations.concat(ExtensionManager.findIarInstallationFromRoot(root));
            });
        }

        return installations;
    }

    private static findIarInstallationFromRoot(root: string): IarInstallation[] {
        let installations: IarInstallation[] = [];

        if(fs.existsSync(root)) {
            let children = fs.readdirSync(root);

            children.forEach(child => {
                let installationPath = path.join(root, child);
                let installation = new IarInstallation(installationPath);

                if(installation.isValidInstallation()) {
                    installations.push(installation);
                }
            });
        }

        return installations;
    }

    public generateCCppPropertiesFile(): Error | undefined {
        if(this.project === undefined) {
            return new Error(sErrorNoProjectFileSpecified);
        }

        let project = this.project;

        let ret = project.parse();

        if (!ret) {
            let wsFolder = vscode.workspace.rootPath;

            if(!wsFolder) {
                return new Error(sErrorNoVsWorkspaceOpened);
            }

            let propertyFileDir = path.join(wsFolder, ".vscode");

            if(fs.existsSync(propertyFileDir)) {
                let stat = fs.statSync(propertyFileDir);

                if(!stat.isDirectory()) {
                    return new Error(sErrorNotADirectory);
                }
            } else {
                fs.mkdirSync(propertyFileDir);
            }

            let propertyFilePath = path.join(propertyFileDir, "c_cpp_properties.json");
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

        return undefined;
    }
}