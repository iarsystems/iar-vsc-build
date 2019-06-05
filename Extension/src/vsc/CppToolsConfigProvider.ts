
'use strict';

import * as Vscode from "vscode";
import * as Path from "path";
import { CppToolsApi, Version, CustomConfigurationProvider, getCppToolsApi, SourceFileConfigurationItem, WorkspaceBrowseConfiguration, SourceFileConfiguration } from "vscode-cpptools";
import { CppToolsConfigGenerator, language } from "./CppToolsConfigGenerator";
import { Logging } from "../utils/logging";
import { UI } from "../extension/ui/app";
import { Settings } from "../extension/settings";

/* TODO: make setting so users can modify extensions ? */
const cExtensions = [
    ".c", ".h"
];
const cppExtensions = [
    ".cpp",
    ".hpp"
];

const supportedExtensions = cExtensions.concat(cppExtensions);


export class IarConfigurationProvider implements CustomConfigurationProvider {
    private api: CppToolsApi;
    private cppConfiguration: SourceFileConfiguration | undefined;
    private cConfiguration: SourceFileConfiguration | undefined;
    private readonly nullConfigProvider: SourceFileConfiguration = {
        compilerPath: "",
        defines: [],
        forcedInclude: [],
        includePath: [],
        intelliSenseMode: "msvc-x64",
        standard: "c89"
    };

    readonly name = "IAR-cpptools-API";
    readonly extensionId = "pluyckx.iar-vsc";

    constructor(api: CppToolsApi) {
        this.api = api;

        UI.getInstance().compiler.model.addOnSelectedHandler(this.fireConfigurationChanged);
        UI.getInstance().config.model.addOnSelectedHandler(this.fireConfigurationChanged);
        UI.getInstance().project.model.addOnSelectedHandler(this.fireConfigurationChanged);
        Settings.observeSetting(Settings.Field.Defines, this.fireConfigurationChanged);
        Settings.observeSetting(Settings.Field.CStandard, this.fireConfigurationChanged);
        Settings.observeSetting(Settings.Field.CppStandard, this.fireConfigurationChanged);

        this.fireConfigurationChanged();
    }

    canProvideConfiguration(uri: Vscode.Uri, _?: any): Thenable<boolean> {
        return new Promise((resolve) => {
            const fsPath = uri.fsPath;
            const extension = Path.parse(fsPath).ext;

            if (supportedExtensions.indexOf(extension) > -1) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
    }

    provideConfigurations(uris: Vscode.Uri[], _?: any): Thenable<SourceFileConfigurationItem[]> {
        return new Promise((resolve) => {
            resolve(this.generateConfigurations(uris));
        });
    }

    canProvideBrowseConfiguration(_?: any): Thenable<boolean> {
        return new Promise((resolve) => {
            resolve(false);
        });
    }

    provideBrowseConfiguration(_?: any): Thenable<WorkspaceBrowseConfiguration> {
        return new Promise((_, reject) => {
            reject();
        });
    }

    dispose() {
        this.canProvideConfiguration = (): Thenable<boolean> => {
            return new Promise((_, reject) => {
                reject();
            });
        }
    }

    private generateConfigurations(uris: Vscode.Uri[]): SourceFileConfigurationItem[] {
        let configs: SourceFileConfigurationItemImpl[] = [];

        uris.forEach((uri) => {
            Logging.getInstance().debug("Create config for '{0}'", uri.fsPath);

            const language = this.determineLanguage(uri);

            const cConf = (this.cConfiguration) ? this.cConfiguration : this.nullConfigProvider;
            const cppConf = (this.cppConfiguration) ? this.cppConfiguration : this.nullConfigProvider;

            if (language === "c") {
                configs.push(new SourceFileConfigurationItemImpl(uri, cConf));
            } else if (language === "cpp") {
                configs.push(new SourceFileConfigurationItemImpl(uri, cppConf));
            } else {
                Logging.getInstance().warning("Could not detect language for '{0}', using 'nul' configuration", uri.fsPath);
                configs.push(new SourceFileConfigurationItemImpl(uri, this.nullConfigProvider));
            }
        });

        return configs;
    }

    private determineLanguage(uri: Vscode.Uri): "c" | "cpp" | undefined {
        const fsPath = uri.fsPath;
        const extension = Path.parse(fsPath).ext;

        if (cExtensions.indexOf(extension) > -1) {
            return "c";
        } else if (cppExtensions.indexOf(extension) > -1) {
            return "cpp";
        } else {
            return undefined;
        }
    }

    private fireConfigurationChanged() {
        Promise.all([this.generateConfiguration("c"), this.generateConfiguration("cpp")]).then((value) => {
            this.cConfiguration = value[0];
            this.cppConfiguration = value[1];

            this.api.didChangeCustomConfiguration(this);
        });
    }

    private async generateConfiguration(language: "c" | "cpp"): Promise<SourceFileConfiguration> {
        const compiler = UI.getInstance().compiler.model.selected;
        const config = UI.getInstance().config.model.selected;

        return CppToolsConfigGenerator.GenerateConfigObject(language, config, compiler);
    }
}

class SourceFileConfigurationItemImpl implements SourceFileConfigurationItem {
    readonly uri: string | Vscode.Uri;
    readonly configuration: SourceFileConfiguration;

    constructor(uri: Vscode.Uri, configuration: SourceFileConfiguration) {
        this.uri = uri;
        this.configuration = configuration;
    }

    static async create(uri: Vscode.Uri): Promise<SourceFileConfiguration> {
        let path = uri.fsPath;
        let configuration: SourceFileConfiguration;
        let language: language | undefined = undefined;

        if (this.isCFile(path)) {
            language = "c";
        } else if (this.isCppFile(path)) {
            language = "cpp";
        }

        if (language !== undefined) {
            configuration = await CppToolsConfigGenerator.GenerateConfigObject(language, undefined, undefined);
        }

        return new Promise((resolve, reject) => {
            if (language === undefined) {
                reject();
            } else {
                resolve(configuration);
            }
        });
    }

    private static isCFile(path: string): boolean {
        return cExtensions.indexOf(Path.parse(path).ext) > -1;
    }

    private static isCppFile(path: string): boolean {
        return cppExtensions.indexOf(Path.parse(path).ext) > -1;
    }
}

export namespace CppToolsConfigGeneratorProvider {
    let provider: IarConfigurationProvider | undefined = undefined;

    async function init() {
        let api = await getCppToolsApi(Version.v2);

        if (api) {
            if (provider !== undefined) {
                provider.dispose();
            }

            provider = new IarConfigurationProvider(api);

            if (api.notifyReady) {
                api.registerCustomConfigurationProvider(provider);
                api.notifyReady(provider);
            } else {
                api.registerCustomConfigurationProvider(provider);
                api.didChangeCustomConfiguration(provider);
            }
        } else {
            Vscode.window.showWarningMessage("Cannot connect the IAR extension with the Microsoft CppTools extension. Falling back to the 'c_cpp_properties' json file.")
        }
    }

    export async function getInstance(): Promise<IarConfigurationProvider> {
        if (provider === undefined) {
            await init();
        }

        return new Promise((resolve, reject) => {
            if (provider !== undefined) {
                resolve(provider);
            } else {
                reject();
            }
        });
    }
}