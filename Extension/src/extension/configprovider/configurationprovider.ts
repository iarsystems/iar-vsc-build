/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import { DynamicConfigGenerator } from "./dynamicconfiggenerator";
import { CustomConfigurationProvider, getCppToolsApi, Version, CppToolsApi, SourceFileConfiguration, SourceFileConfigurationItem, WorkspaceBrowseConfiguration } from "vscode-cpptools";
import { UI } from "../ui/app";
import { Settings } from "../settings";
import { CancellationToken } from "vscode-jsonrpc";
import { LanguageUtils } from "../../utils/utils";
import { StaticConfigGenerator } from "./staticconfiggenerator";

/**
 * Provides source file configurations for an IAR project to cpptools via the cpptools typescript api.
 * Uses a mix of a fast but imprecise config detection method and a slower but more accurate method.
 */
export class IarConfigurationProvider implements CustomConfigurationProvider {
    private static _instance: IarConfigurationProvider | undefined = undefined;
    public static get instance() { return IarConfigurationProvider._instance; }

    /**
     * Initializes the configuration provider and registers it with the cpptools api
     */
    public static async init(): Promise<boolean> {
        let api = await getCppToolsApi(Version.v2);

        if (api) {
            if (IarConfigurationProvider._instance) {
                IarConfigurationProvider._instance.dispose();
            }

            const instance = new IarConfigurationProvider(api, new DynamicConfigGenerator(), new StaticConfigGenerator());
            IarConfigurationProvider._instance = instance;
            return true;
        } else {
            Vscode.window.showWarningMessage("Cannot connect the IAR extension with the Microsoft CppTools extension. Falling back to the 'c_cpp_properties' json file.");
        }
        return false;
    }

    private readonly nullConfiguration: SourceFileConfiguration = {defines: [], includePath: [], standard: "c89", intelliSenseMode: "msvc-x64"};
    private fallbackConfigurationC: SourceFileConfiguration = this.nullConfiguration;
    private fallbackConfigurationCpp: SourceFileConfiguration = this.nullConfiguration;

    readonly name = "IAR-cpptools-API";
    readonly extensionId = "pluyckx.iar-vsc";

    private constructor(private api: CppToolsApi, private generator: DynamicConfigGenerator, private fallbackGenerator: StaticConfigGenerator) {
        UI.getInstance().compiler.model.addOnSelectedHandler(this.onSettingsChanged.bind(this));
        UI.getInstance().config.model.addOnSelectedHandler(this.onSettingsChanged.bind(this));
        UI.getInstance().project.model.addOnSelectedHandler(this.onSettingsChanged.bind(this));
        Settings.observeSetting(Settings.Field.Defines, this.onSettingsChanged.bind(this));
        Settings.observeSetting(Settings.Field.CStandard, this.onSettingsChanged.bind(this));
        Settings.observeSetting(Settings.Field.CppStandard, this.onSettingsChanged.bind(this));

        this.api.registerCustomConfigurationProvider(this);
        // to provide configs as fast as possible at startup, do notifyReady as soon as fallback configs are ready,
        // and let the configs be updated when accurate configs are available
        this.generateFallbackConfigs();
        this.api.notifyReady(this);
        this.generateAccurateConfigs();
    }

    // cpptools api methods
    canProvideConfiguration(uri: Vscode.Uri, _token?: CancellationToken | undefined): Thenable<boolean> {
        const lang = LanguageUtils.determineLanguage(uri.fsPath);
        return Promise.resolve(lang !== undefined);
    }
    provideConfigurations(uris: Vscode.Uri[], _token?: CancellationToken | undefined): Promise<SourceFileConfigurationItem[]> {
        return Promise.resolve(uris.map(uri => {
            const lang = LanguageUtils.determineLanguage(uri.fsPath);
            const baseConfiguration = lang === "c" ? this.fallbackConfigurationC : this.fallbackConfigurationCpp;
            let includes = this.generator.getIncludes(uri).map(i => i.absolutePath.toString());
            includes = includes.concat(baseConfiguration.includePath.filter(inc => !includes.includes(inc)));
            let defines = this.generator.getDefines(uri).map(d => `${d.identifier}=${d.value}`);
            defines = defines.concat(baseConfiguration.defines.filter(def => !defines.includes(def)));
            defines = defines.concat(Settings.getDefines()); // user-defined extra macros

            const config = {
                compilerPath: baseConfiguration.compilerPath,
                defines: defines,
                includePath: includes,
                forcedInclude: baseConfiguration.forcedInclude,
                intelliSenseMode: baseConfiguration.intelliSenseMode,
                standard: baseConfiguration.standard,
            };
            return {
                uri: uri,
                configuration: config,
            };
        }));
    }
    canProvideBrowseConfiguration(_token?: CancellationToken | undefined): Thenable<boolean> {
        return Promise.resolve(false);
    }
    provideBrowseConfiguration(_token?: CancellationToken | undefined): Thenable<WorkspaceBrowseConfiguration> {
        return Promise.reject();
    }
    canProvideBrowseConfigurationsPerFolder(_token?: CancellationToken | undefined): Thenable<boolean> {
        return Promise.resolve(false);
    }
    provideFolderBrowseConfiguration(_uri: Vscode.Uri, _token?: CancellationToken | undefined): Thenable<WorkspaceBrowseConfiguration> {
        return Promise.reject();
    }
    dispose() {
        this.canProvideConfiguration = (): Thenable<boolean> => Promise.reject(false);
        this.api.dispose();
        this.generator.dispose();
    }

    private generateFallbackConfigs() {
        this.fallbackConfigurationC = this.fallbackGenerator.generateConfiguration("c", UI.getInstance().config.model.selected!, UI.getInstance().compiler.model.selected!);
        this.fallbackConfigurationCpp = this.fallbackGenerator.generateConfiguration("cpp", UI.getInstance().config.model.selected!, UI.getInstance().compiler.model.selected!);
    }

    // returns true if configs changed
    private async generateAccurateConfigs(): Promise<boolean> {
        await this.generator.cancelCurrentOperation();

        const workbench = UI.getInstance().workbench.model.selected;
        const compiler = UI.getInstance().compiler.model.selected;
        const config = UI.getInstance().config.model.selected;
        const project = UI.getInstance().project.model.selected;
        if (!workbench || !compiler || !config || !project) {
            return false;
        }
        try {
            return await this.generator.generateConfiguration(workbench, project, compiler, config);
        } catch (err) {
            if (err) { Vscode.window.showErrorMessage("IAR: Failed to load project configuration: " + err); }
            return false;
        }
    }

    private async onSettingsChanged() {
        this.generateFallbackConfigs();
        const changed = await this.generateAccurateConfigs();
        if (changed) { this.api.didChangeCustomConfiguration(this); }
    }
}