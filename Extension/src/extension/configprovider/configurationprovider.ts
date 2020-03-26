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
import { StaticConfigGenerator, PartialSourceFileConfiguration } from "./staticconfiggenerator";
import { IncludePath } from "../../iar/project/includepath";
import { Define } from "../../iar/project/define";

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

    private fallbackConfigurationC: PartialSourceFileConfiguration = {includes: [], preIncludes: [], defines: []};
    private fallbackConfigurationCpp: PartialSourceFileConfiguration = {includes: [], preIncludes: [], defines: []};

    readonly name = "IAR-cpptools-API";
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

            const includes = this.mergeIncludeArrays(this.generator.getIncludes(uri), baseConfiguration.includes);
            const stringIncludes = includes.map(i => i.absolutePath.toString());

            const defines = this.mergeDefineArrays(this.generator.getDefines(uri), baseConfiguration.defines);
            let stringDefines = defines.map(d => `${d.identifier}=${d.value}`);
            stringDefines = stringDefines.concat(Settings.getDefines()); // user-defined extra macros

            const config: SourceFileConfiguration = {
                compilerPath: "",
                defines: stringDefines,
                includePath: stringIncludes,
                forcedInclude: baseConfiguration.preIncludes.map(i => i.absolutePath.toString()),
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
        this.fallbackConfigurationC = StaticConfigGenerator.generateConfiguration("c", UI.getInstance().config.model.selected!, UI.getInstance().compiler.model.selected!);
        this.fallbackConfigurationCpp = StaticConfigGenerator.generateConfiguration("cpp", UI.getInstance().config.model.selected!, UI.getInstance().compiler.model.selected!);
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

    // merges two include path arrays, removing duplicates
    private mergeIncludeArrays(arr1: IncludePath[], arr2: IncludePath[]) {
        const arr1Uniques = arr1.filter(path1 => !arr2.some(path2 => path1.absolutePath === path2.absolutePath));
        return arr1Uniques.concat(arr2);
    }
    // merges two defines arrays, removing duplicates
    private mergeDefineArrays(arr1: Define[], arr2: Define[]) {
        const arr1Uniques = arr1.filter(path1 => !arr2.some(path2 => path1.identifier === path2.identifier));
        return arr1Uniques.concat(arr2);
    }
}