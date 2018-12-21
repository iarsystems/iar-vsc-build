
import * as vscode from 'vscode';

import * as fs from 'fs';
import * as path from 'path';

import { Project } from "./iar/project";
import { CCppPropertiesFile } from './vsc/c_cpp_properties';
import { sErrorNoProjectFileSpecified, sErrorNoVsWorkspaceOpened, sErrorNotADirectory, sErrorNotAnIarInstallationFolder } from './iar/errors';
import { Settings } from './extension/settings';
import { IarInstallation } from './iar/iar';
import { CompilerDefine, Define, IarExtensionDefine } from './iar/define';
import { Config } from './iar/config';
import { spawn, ChildProcess } from 'child_process';
import { IncludePath, StringIncludePath } from './iar/includepaths';

export class ExtensionManager {
    private project: Project | undefined;
    private settings: Settings;
    private iar: IarInstallation | undefined;

    private buildProcess?: ChildProcess;

    constructor() {
        this.settings = new Settings();
        this.init();
    }

    public init(): void {
        this.settings.load();

        if (this.settings.ewpLocation !== undefined) {
            let ret = this.setIarProjectPath(this.settings.ewpLocation);

            if (ret !== undefined) {
                vscode.window.showErrorMessage(ret.message);
            }
        }

        if (this.settings.iarLocation !== undefined) {
            let ret = undefined;

            if (this.settings.processor !== undefined) {
                ret = this.setIarLocation(this.settings.iarLocation,
                    this.settings.processor);
            }
            else {
                ret = this.setIarLocation(this.settings.iarLocation,
                    "");
            }

            if (ret !== undefined) {
                vscode.window.showErrorMessage(ret.message);
            }
        }
    }

    public isConfigured(): boolean {
        return (this.project !== undefined) && (this.iar !== undefined);
    }

    public setIarLocation(path: fs.PathLike, processor: string): Error | undefined {
        let iar = new IarInstallation(path, processor);

        if (iar.isValidInstallation()) {
            this.iar = iar;

            /*
            **  Dan Bomsta: Trying to fix https://github.com/pluyckx/iar-vsc/issues/4, when there are
            **  multiple microprocessor IAR installations.
            */
            if (this.settings.ewpLocation === "" || this.iar.getCompilerLocation() === "") {
                /*
                **  Possible multiple processor installation. So we force the user to select
                **  the project file now in order to find the correct compiler.
                **  Should we check the return from executeCommand?
                **  This appears to be asynchronous == it returns immediately.  So we will
                **  have the handle in setIarProjectPath.
                */
                vscode.commands.executeCommand("iar.selectIarProject");
            }
            else if (this.settings.iarLocation !== this.iar.getLocation()) {
                this.settings.iarLocation = this.iar.getLocation();
                this.settings.storeSettings();
            }

            return undefined;
        } else {
            return Error(sErrorNotAnIarInstallationFolder);
        }
    }

    public setIarProjectPath(filename: string): Error | undefined {
        let project = new Project(filename);

        let ret = project.parse();

        if (ret === undefined) {
            let oldProject = this.project;
            this.project = project;

            if ((oldProject === undefined) || (oldProject.getLocation().toString() !== filename)) {
                this.settings.ewpLocation = this.project.getLocation().toString();

                this.settings.storeSettings();
            }
            else if (!this.iar || this.iar.getCompilerLocation() === "") {
                this.settings.processor = this.project.getToolchain();
                this.settings.storeSettings();

                /* For Sync to work we update our IarInstallation object */
                if (this.iar) {
                    this.iar.setProcessor(this.settings.processor);
                }
            }
        }

        return ret;
    }

    public findIarProjectFiles(): fs.PathLike[] {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            return Project.findProjectFiles(vscode.workspace.workspaceFolders[0].uri.fsPath, true);
        } else {
            return [];
        }
    }

    public findIarInstallations(): IarInstallation[] {
        let installations: IarInstallation[] = [];

        let settings = vscode.workspace.getConfiguration("iarvsc");
        let iarRootPaths: string[] | undefined = settings.get('iarRootPaths');

        if (iarRootPaths) {
            iarRootPaths.forEach(root => {
                installations = installations.concat(ExtensionManager.findIarInstallationFromRoot(root));
            });
        }

        return installations;
    }

    public build(rebuild: boolean): void {
        let selectedConfig: Config | undefined = undefined;

        if (!this.project) {
            vscode.window.showErrorMessage("No IAR project is selected.");
            return;
        }

        if (!this.iar) {
            vscode.window.showErrorMessage("No IAR installation selected.");
            return;
        }

        let process = this.buildProcess;
        if (process !== undefined) {
            vscode.window.showErrorMessage("Previous build command is still running. Try again.");

            process.kill('SIGTERM');
            return;
        }

        let iar = this.iar;
        let project = this.project;
        let configurationNames: string[] = [];
        let prevConfigBuildName = this.settings.buildConfig;

        project.getConfigs().forEach(config => {
            if ((prevConfigBuildName !== undefined) && (prevConfigBuildName === config.getName())) {
                /* add previous build as first item in the list so the user can just press enter */
                configurationNames = [config.getName()].concat(configurationNames);
            } else {
                configurationNames.push(config.getName());
            }
        });

        vscode.window.showQuickPick(configurationNames, { placeHolder: 'Select build configuration', canPickMany: false }).then((selected) => {
            if (selected) {
                selectedConfig = project.findConfigWithName(selected);

                if (selectedConfig === undefined) {
                    return;
                }

                this.settings.buildConfig = selected;
                this.settings.storeSettings();

                let iarBuildLocation = iar.getIarBuildLocation().toString();
                let ewpLocation = project.getLocation().toString();
                let iarCommand = "-make";

                if (rebuild) {
                    iarCommand = "-build";
                }

                let out = vscode.window.createOutputChannel("IAR");
                out.show(false);

                console.log("executing \"", iarBuildLocation, "\" with parameters ", ewpLocation, " -make ", selectedConfig.getName());

                this.buildProcess = spawn(iarBuildLocation, [ewpLocation, iarCommand, selectedConfig.getName()], { stdio: ['ignore', 'pipe', 'ignore'] });

                this.buildProcess.on('exit', (_code, _signal) => {
                    if (this.buildProcess) {
                        this.buildProcess.removeAllListeners();
                        this.buildProcess = undefined;
                    }
                });

                this.buildProcess.stdout.on('data', (chunk) => {
                    out.append(chunk.toString());
                });
            }
        });
    }

    private static findIarInstallationFromRoot(root: string): IarInstallation[] {
        let installations: IarInstallation[] = [];

        if (fs.existsSync(root)) {
            let children = fs.readdirSync(root);

            children.forEach(child => {
                let installationPath = path.join(root, child);
                let installation = new IarInstallation(installationPath, "");

                if (installation.isValidInstallation()) {
                    installations.push(installation);
                }
            });
        }

        return installations;
    }

    public generateCCppPropertiesFile(): Error | undefined {
        if (this.project === undefined) {
            return new Error(sErrorNoProjectFileSpecified);
        }

        let project = this.project;

        let ret = project.parse();

        if (!ret) {
            let wsFolder = vscode.workspace.rootPath;

            if (!wsFolder) {
                return new Error(sErrorNoVsWorkspaceOpened);
            }

            let propertyFileDir = path.join(wsFolder, ".vscode");

            if (fs.existsSync(propertyFileDir)) {
                let stat = fs.statSync(propertyFileDir);

                if (!stat.isDirectory()) {
                    return new Error(sErrorNotADirectory);
                }
            } else {
                fs.mkdirSync(propertyFileDir);
            }

            let propertyFilePath = path.join(propertyFileDir, "c_cpp_properties.json");
            let prop: CCppPropertiesFile = new CCppPropertiesFile();

            if (fs.existsSync(propertyFilePath)) {
                fs.copyFileSync(propertyFilePath, propertyFilePath + ".back");

                prop.load(propertyFilePath);
            }

            let compilerDefines: Define[] = [];
            let iarExtensionDefines: Define[] = [] // IarExtensionDefine.generate();
            let systemIncludes: IncludePath[] = [];
            if (this.iar) {
                // compilerDefines = CompilerDefine.generateCompilerDefines(this.iar.getCompilerLocation());
                systemIncludes = StringIncludePath.generateSystemIncludePaths(this.iar);
            }

            project.getConfigs().forEach(config => {
                config.setCompilerDefines(compilerDefines);
                config.setIarExtensionDefines(iarExtensionDefines);
                config.setSystemIncludes(systemIncludes);
                prop.setConfiguration(config);
            });

            prop.write(propertyFilePath);
        }

        return undefined;
    }
}