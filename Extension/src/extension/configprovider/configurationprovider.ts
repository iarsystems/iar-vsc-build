/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import { ConfigGenerator } from "./configgenerator";
import { CustomConfigurationProvider, getCppToolsApi, Version, CppToolsApi, SourceFileConfiguration, SourceFileConfigurationItem, WorkspaceBrowseConfiguration } from "vscode-cpptools";
import { UI } from "../ui/app";
import { Settings } from "../settings";
import { CancellationToken } from "vscode-jsonrpc";
import { LanguageUtils } from "../../utils/utils";
import { JsonConfigurationWriter } from "./jsonconfigurationwriter";
import { PartialSourceFileConfiguration } from "./data/partialsourcefileconfiguration";
import { Workbench } from "../../iar/tools/workbench";
import { Config } from "../../iar/project/config";
import * as Path from "path";
import { IarOsUtils } from "../../../utils/osUtils";
import { FsUtils } from "../../utils/fs";
import { ConfigurationSet } from "./configurationset";
import { Keyword } from "./data/keyword";
import { Define } from "./data/define";

/**
 * Provides source file configurations for an IAR project to cpptools via the cpptools typescript api
 * and the c_cpp_properties.json file.
 */
export class IarConfigurationProvider implements CustomConfigurationProvider {
    private static _instance: IarConfigurationProvider | undefined = undefined;
    public static get instance() {
        return IarConfigurationProvider._instance;
    }

    /**
     * Initializes the configuration provider and registers it with the cpptools api
     */
    public static async init(): Promise<boolean> {
        const api = await getCppToolsApi(Version.v2);

        if (api) {
            if (IarConfigurationProvider._instance) {
                IarConfigurationProvider._instance.dispose();
            }

            const instance = new IarConfigurationProvider(api, new ConfigGenerator());
            IarConfigurationProvider._instance = instance;
            return true;
        } else {
            Vscode.window.showWarningMessage("Cannot connect the IAR extension with the Microsoft CppTools extension. Falling back to the 'c_cpp_properties' json file.");
        }
        return false;
    }

    /**
     * Forces the provider to regenerate configurations for all source files
     * @param revealLog Wether to raise focus for the output channel showing the configuration generation logs
     */
    public forceUpdate(revealLog = false) {
        if (revealLog) this.generator.showOutputChannel();
        return this.onSettingsChanged();
    }

    /**
     * Returns whether a file belongs to the current project. Exposed for testing purposes.
     */
    public isProjectFile(file: string) {
        return this.fileConfigs.getIncludes(file) !== undefined;
    }

    // Blanket config that we apply when we don't have a file-specific config (i.e. header files, or a file not in the project)
    private fallbackConfig: PartialSourceFileConfiguration = {includes: [], preincludes: [], defines: []};
    // Configs for all source files in the project
    private fileConfigs: ConfigurationSet = new ConfigurationSet(new Map(), new Map(), new Map());
    // To force cpptools to recognize extended keywords we pretend they're compiler-defined macros
    private keywordDefines: Define[] = [];

    readonly name = "iar-vsc";
    readonly extensionId = "pluyckx.iar-vsc";

    private constructor(private readonly api: CppToolsApi, private readonly generator: ConfigGenerator) {
        // Note that changing the project will also trigger a config change
        // Note that we do not return the promise from onSettingsChanged, because the model does not need to wait for it to finish
        UI.getInstance().config.model.addOnSelectedHandler(() => {
            this.onSettingsChanged();
        });
        UI.getInstance().workbench.model.addOnSelectedHandler(() => {
            this.onSettingsChanged();
        });
        Settings.observeSetting(Settings.ExtensionSettingsField.Defines, this.onSettingsChanged.bind(this));
        Settings.observeSetting(Settings.ExtensionSettingsField.CStandard, this.onSettingsChanged.bind(this));
        Settings.observeSetting(Settings.ExtensionSettingsField.CppStandard, this.onSettingsChanged.bind(this));

        this.api.registerCustomConfigurationProvider(this);
        this.api.notifyReady(this);
        this.onSettingsChanged();
    }

    // cpptools api methods
    canProvideConfiguration(uri: Vscode.Uri, _token?: CancellationToken | undefined): Thenable<boolean> {
        const lang = LanguageUtils.determineLanguage(uri.fsPath);
        return Promise.resolve(lang !== undefined);
    }
    provideConfigurations(uris: Vscode.Uri[], _token?: CancellationToken | undefined): Promise<SourceFileConfigurationItem[]> {
        const cStandard = Settings.getCStandard();
        const cppStandard = Settings.getCppStandard();

        return Promise.resolve(uris.map(uri => {
            const lang = LanguageUtils.determineLanguage(uri.fsPath);
            const includes = this.fileConfigs.getIncludes(uri.fsPath) ?? this.fallbackConfig.includes;
            let defines = this.fileConfigs.getDefines(uri.fsPath) ?? this.fallbackConfig.defines;
            defines = defines.concat(this.keywordDefines);
            const preincludes = this.fileConfigs.getPreincludes(uri.fsPath) ?? this.fallbackConfig.preincludes;

            let stringDefines = defines.map(d => d.makeString());
            stringDefines = stringDefines.concat(Settings.getDefines()); // user-defined extra macros

            const config: SourceFileConfiguration = {
                compilerPath: "",
                defines: stringDefines,
                includePath: includes.map(i => i.absolutePath.toString()),
                forcedInclude: preincludes.map(i => i.absolutePath.toString()),
                intelliSenseMode: "clang-arm",
                standard: lang === "c" ? cStandard : cppStandard,
            };
            return {
                uri: uri,
                configuration: config,
            };
        }));
    }
    canProvideBrowseConfiguration(_token?: CancellationToken | undefined): Thenable<boolean> {
        return Promise.resolve(true);
    }
    provideBrowseConfiguration(_token?: CancellationToken | undefined): Thenable<WorkspaceBrowseConfiguration> {
        return Promise.resolve({
            browsePath: this.fallbackConfig.includes.map(i => i.absolutePath.toString()),
            compilerPath: "",
            compilerArgs: [],
            standard: Settings.getCStandard(),
            windowsSdkVersion: ""
        });
    }
    canProvideBrowseConfigurationsPerFolder(_token?: CancellationToken | undefined): Thenable<boolean> {
        return Promise.resolve(false);
    }
    provideFolderBrowseConfiguration(_uri: Vscode.Uri, _token?: CancellationToken | undefined): Thenable<WorkspaceBrowseConfiguration | null> {
        return Promise.resolve(null);
    }
    dispose() {
        this.canProvideConfiguration = (): Thenable<boolean> => Promise.resolve(false);
        this.api.dispose();
        this.generator.dispose();
    }

    private async generateFallbackConfig() {
        // Simply take the sum of all file configs.
        // It isn't perfect, but it doesn't need to be and there is no perfect solution AFAIK.
        const includes = this.fileConfigs.allIncludes;
        let defines = this.fileConfigs.allDefines;
        defines = defines.concat(this.keywordDefines);
        defines = defines.concat(Settings.getDefines().map(Define.fromString)); // user-defined extra macros
        const preincludes = this.fileConfigs.allPreincludes;
        this.fallbackConfig = { includes, defines, preincludes };
        await JsonConfigurationWriter.writeJsonConfiguration(this.fallbackConfig, this.name);
    }

    // returns true if configs changed
    private async generateSourceConfigs(): Promise<boolean> {
        const workbench = UI.getInstance().workbench.model.selected;
        const config = UI.getInstance().config.model.selected;
        const project = UI.getInstance().project.model.selected;
        if (!workbench || !config || !project) {
            return false;
        }
        try {
            this.fileConfigs = await this.generator.generateSourceConfigs(workbench, project, config);
            return true;
        } catch (err) {
            if (err !== ConfigGenerator.CanceledError) {
                // Show error msg with a button to see the logs
                Vscode.window.showErrorMessage("IAR: Failed to load project configuration: " + err, { title: "Show Output Window"}).then(res => {
                    if (res !== undefined) {
                        this.generator.showOutputChannel();
                    }
                });
            }
            return false;
        }
    }


    private async generateKeywordDefines() {
        const workbench = UI.getInstance().workbench.model.selected;
        const config = UI.getInstance().config.model.selected;
        if (!workbench || !config) {
            return;
        }
        const compiler = getCompilerForConfig(config, workbench);
        if (!compiler) {
            return;
        }
        // C syntax files are named <platform dir>/config/syntax_icc.cfg
        const platformBasePath = Path.join(Path.dirname(compiler), "..");
        const filePath         = platformBasePath + "/config/syntax_icc.cfg";
        if (await FsUtils.exists(filePath)) {
            const keywords = await Keyword.fromSyntaxFile(filePath);
            this.keywordDefines = keywords.map(kw => Keyword.toDefine(kw));
        }
    }

    private async onSettingsChanged() {
        let changed = false;
        await Promise.all([
            this.generateKeywordDefines(),
            this.generateSourceConfigs().then(didChange => changed = didChange),
        ]);
        this.generateFallbackConfig();
        if (changed) {
            this.api.didChangeCustomConfiguration(this);
        }
    }
}

/**
 * Finds the compiler to use for the given config, and returns its path.
 * May return undefined, e.g. if the workbench doesn't have the required target installed.
 */
function getCompilerForConfig(config: Config, workbench: Workbench): string | undefined {
    const toolchainBinDir = Path.join(workbench.path.toString(), config.toolchainId.toLowerCase(), "bin");
    const regex = "icc.*" + IarOsUtils.executableExtension();
    const filter = FsUtils.createFilteredListDirectoryFilenameRegex(new RegExp(regex));
    const compilerPaths = FsUtils.filteredListDirectory(toolchainBinDir, filter);
    if (compilerPaths[0] !== undefined) {
        if (compilerPaths.length > 1) {
            console.error(`Found more than one compiler candidate for ${config.toolchainId} in ${workbench}.`);
        }
        return compilerPaths[0].toString();
    }
    console.log(`Didn't find a compiler for ${config.toolchainId} in ${workbench.path}.`);
    return undefined;
}