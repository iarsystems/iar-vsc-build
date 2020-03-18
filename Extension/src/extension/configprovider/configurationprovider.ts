/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import { IarConfigurationGenerator } from "./configurationgenerator";
import { CustomConfigurationProvider, getCppToolsApi, Version, CppToolsApi, SourceFileConfiguration, SourceFileConfigurationItem, WorkspaceBrowseConfiguration } from "vscode-cpptools";
import { UI } from "../ui/app";
import { Settings } from "../settings";
import { CancellationToken } from "vscode-jsonrpc";

/**
 * Provides source file configurations for an IAR project to cpptools via the cpptools typescript api.
 * Most of the work is done by the IarConfigurationGenerator class, this is just to interface with the api.
 */
export class IarConfigurationProvider implements CustomConfigurationProvider {
    private static _instance: IarConfigurationProvider | undefined = undefined;
    public static get instance() { return IarConfigurationProvider._instance; }

    public static async init(): Promise<boolean> {
        let api = await getCppToolsApi(Version.v2);

        if (api) {
            if (IarConfigurationProvider._instance) {
                IarConfigurationProvider._instance.dispose();
            }

            const instance = new IarConfigurationProvider(api, new IarConfigurationGenerator());
            IarConfigurationProvider._instance = instance;
            api.registerCustomConfigurationProvider(instance);
            return true;
        } else {
            Vscode.window.showWarningMessage("Cannot connect the IAR extension with the Microsoft CppTools extension. Falling back to the 'c_cpp_properties' json file.");
        }
        return false;
    }


    private readonly nullConfiguration: SourceFileConfiguration = {
        compilerPath: "",
        defines: [],
        forcedInclude: [],
        includePath: [],
        intelliSenseMode: "msvc-x64",
        standard: "c11"
    };

    readonly name = "IAR-cpptools-API";
    readonly extensionId = "pluyckx.iar-vsc";

    private constructor(private api: CppToolsApi, private generator: IarConfigurationGenerator) {
        UI.getInstance().compiler.model.addOnSelectedHandler(this.onSettingsChanged.bind(this));
        UI.getInstance().config.model.addOnSelectedHandler(this.onSettingsChanged.bind(this));
        UI.getInstance().project.model.addOnSelectedHandler(this.onSettingsChanged.bind(this));
        Settings.observeSetting(Settings.Field.Defines, this.onSettingsChanged.bind(this)); // TODO: are these needed?
        Settings.observeSetting(Settings.Field.CStandard, this.onSettingsChanged.bind(this));
        Settings.observeSetting(Settings.Field.CppStandard, this.onSettingsChanged.bind(this));

        this.generateConfigs().then(() => {
            this.api.notifyReady(this);
        });
    }

    canProvideConfiguration(_uri: Vscode.Uri, _token?: CancellationToken | undefined): Thenable<boolean> {
        return Promise.resolve(true);
    }
    provideConfigurations(uris: Vscode.Uri[], _token?: CancellationToken | undefined): Promise<SourceFileConfigurationItem[]> {
        return Promise.resolve(uris.map(uri => {
            const defines = this.generator.getDefines(uri).map(d => `${d.identifier}=${d.value}`);
            const includes = this.generator.getIncludes(uri).map(i => i.absolutePath.toString());
            const config = {
                compilerPath: this.nullConfiguration.compilerPath,
                defines: defines.concat(this.nullConfiguration.defines),
                includePath: includes.concat(this.nullConfiguration.includePath),
                forcedInclude: this.nullConfiguration.forcedInclude,
                intelliSenseMode: this.nullConfiguration.intelliSenseMode,
                standard: this.nullConfiguration.standard, // TODO: maybe change depending on language
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

    private async generateConfigs(): Promise<boolean> {
        const workbench = UI.getInstance().workbench.model.selected;
        const compiler = UI.getInstance().compiler.model.selected;
        const config = UI.getInstance().config.model.selected;
        const project = UI.getInstance().project.model.selected;
        if (!workbench || !compiler || !config || !project) {
            return false;
        }
        try {
            await this.generator.generateConfiguration(workbench, project, compiler, config);
            return true;
        } catch (err) {
            if (err) { Vscode.window.showErrorMessage("IAR: Failed to load project configuration: " + err); }
            return false;
        }
    }

    private async onSettingsChanged() {
        await this.generator.cancelCurrentOperation();
        const changed = await this.generateConfigs();
        if (changed) { this.api.didChangeCustomConfiguration(this); }
    }
}