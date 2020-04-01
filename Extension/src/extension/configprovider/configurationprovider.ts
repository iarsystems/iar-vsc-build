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
import { JsonConfigurationWriter } from "./jsonconfigurationwriter";
import { PartialSourceFileConfiguration } from "./data/partialsourcefileconfiguration";

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

            const instance = new IarConfigurationProvider(api, new DynamicConfigGenerator());
            IarConfigurationProvider._instance = instance;
            return true;
        } else {
            Vscode.window.showWarningMessage("Cannot connect the IAR extension with the Microsoft CppTools extension. Falling back to the 'c_cpp_properties' json file.");
        }
        return false;
    }

    /**
     * Forces the provider to regenerate configurations for all source files
     */
    public forceUpdate(): Promise<void> {
        return this.onSettingsChanged();
    }

    private fallbackConfigurationC: PartialSourceFileConfiguration = {includes: [], preIncludes: [], defines: []};
    private fallbackConfigurationCpp: PartialSourceFileConfiguration = {includes: [], preIncludes: [], defines: []};

    readonly name = "IAR-cpptools-API"; //TODO: rename
    readonly extensionId = "pluyckx.iar-vsc";

    private constructor(private api: CppToolsApi, private generator: DynamicConfigGenerator) {
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
        this.generateAccurateConfigs().then((didChange: boolean) => {
            if (didChange) { this.api.didChangeCustomConfiguration(this); }
        });
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
            const baseConfiguration = lang === "c" ? this.fallbackConfigurationC : this.fallbackConfigurationCpp;
            const fileConfiguration = { includes: this.generator.getIncludes(uri), preIncludes: [], defines: this.generator.getDefines(uri) };
            const mergedConfiguration = PartialSourceFileConfiguration.merge(baseConfiguration, fileConfiguration);

            let stringDefines = mergedConfiguration.defines.map(d => d.makeString());
            stringDefines = stringDefines.concat(Settings.getDefines()); // user-defined extra macros

            const config: SourceFileConfiguration = {
                compilerPath: "",
                defines: stringDefines,
                includePath: mergedConfiguration.includes.map(i => i.absolutePath.toString()),
                forcedInclude: mergedConfiguration.preIncludes.map(i => i.absolutePath.toString()),
                intelliSenseMode: "msvc-x64",
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
        const mergedConfig = PartialSourceFileConfiguration.merge(this.fallbackConfigurationC, this.fallbackConfigurationCpp);
        const result: WorkspaceBrowseConfiguration = {
            browsePath: mergedConfig.includes.map(i => i.absolutePath.toString()),
            compilerPath: "",
            compilerArgs: [],
            standard: Settings.getCStandard(),
            windowsSdkVersion: ""
        }
        return Promise.resolve(result);
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
        const compiler = UI.getInstance().compiler.model.selected;
        const config = UI.getInstance().config.model.selected;
        const project = UI.getInstance().project.model.selected;
        this.fallbackConfigurationC   = StaticConfigGenerator.generateConfiguration("c", config, project, compiler);
        this.fallbackConfigurationCpp = StaticConfigGenerator.generateConfiguration("cpp", config, project, compiler);
        const mergedConfig = PartialSourceFileConfiguration.merge(this.fallbackConfigurationC, this.fallbackConfigurationCpp);
        JsonConfigurationWriter.writeJsonConfiguration(mergedConfig, this.name);
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
            Vscode.window.showErrorMessage("IAR: Failed to load project configuration: " + err);
            return false;
        }
    }

    private async onSettingsChanged() {
        this.generateFallbackConfigs();
        const changed = await this.generateAccurateConfigs();
        if (changed) { this.api.didChangeCustomConfiguration(this); }
    }
}