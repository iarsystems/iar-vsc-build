/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import { CustomConfigurationProvider, getCppToolsApi, Version, CppToolsApi, SourceFileConfiguration, SourceFileConfigurationItem, WorkspaceBrowseConfiguration } from "vscode-cpptools";
import { LanguageUtils } from "../../utils/utils";
import { Define } from "./data/define";
import { logger } from "iar-vsc-common/logger";
import { IntellisenseInfoService } from "./intellisenseservice";

/**
 * Provides intellisense configurations for an IAR project to cpptools via the cpptools typescript api.
 */
export class CpptoolsIntellisenseService implements CustomConfigurationProvider {
    private static _instance: CpptoolsIntellisenseService | undefined = undefined;
    public static get instance() {
        return CpptoolsIntellisenseService._instance;
    }

    /**
     * Initializes the configuration provider and registers it with the cpptools api
     */
    public static async init() {
        const api = await getCppToolsApi(Version.v2);

        if (!api) {
            Vscode.window.showWarningMessage("Cannot connect the IAR extension with the Microsoft CppTools extension. Intellisense may behave incorrectly.");
            return;
        }
        if (CpptoolsIntellisenseService._instance) {
            CpptoolsIntellisenseService._instance.close();
        }

        const instance = new CpptoolsIntellisenseService(api);
        CpptoolsIntellisenseService._instance = instance;
    }

    readonly name = "IAR Build";
    readonly extensionId = "iarsystems.iar-build";


    private readonly output: Vscode.OutputChannel = Vscode.window.createOutputChannel("IAR Config Generator");
    private readonly intellisenseInfoProvider: IntellisenseInfoService;

    private hasNotifiedReady = false;

    /**
     * Unregister and dispose of this provider.
     * Use this instead of calling {@link dispose}; calling this will indirectly call {@link dispose}.
     */
    public close() {
        this.api.dispose();
    }

    private constructor(private readonly api: CppToolsApi) {
        this.intellisenseInfoProvider = new IntellisenseInfoService(this.output);
        this.api.registerCustomConfigurationProvider(this);
        this.intellisenseInfoProvider.onIntellisenseInfoChanged(() => {
            logger.debug("Intellisense config changed. Notifying cpptools.");
            if (!this.hasNotifiedReady) {
                this.api.notifyReady(this);
                this.hasNotifiedReady = true;
            }
            this.api.didChangeCustomConfiguration(this);
            this.api.didChangeCustomBrowseConfiguration(this);
        });
    }

    /**
     * Forces the provider to regenerate configurations for all source files.
     * Useful in tests to make sure the configuration has been updated before continuing.
     */
    public forceUpdate() {
        return this.intellisenseInfoProvider?.forceUpdate();
    }

    /**
     * Returns whether this class has intellisense information about a file. Exposed for testing purposes.
     */
    public canHandleFile(file: string) {
        return this.intellisenseInfoProvider?.canHandleFile(file) ?? false;
    }

    // cpptools api methods
    canProvideConfiguration(uri: Vscode.Uri, _token?: Vscode.CancellationToken | undefined): Promise<boolean> {
        const lang = LanguageUtils.determineLanguage(uri.fsPath);
        return Promise.resolve(lang !== undefined);
    }
    async provideConfigurations(uris: Vscode.Uri[], token?: Vscode.CancellationToken | undefined): Promise<SourceFileConfigurationItem[]> {
        const results = await Promise.allSettled(uris.map(async(uri) => {
            const intellisenseInfo = await this.intellisenseInfoProvider.provideIntellisenseInfoFor(uri.fsPath);
            const includes = intellisenseInfo.includes;
            const preincludes = intellisenseInfo.preincludes;

            let defines = intellisenseInfo.defines;
            // Temporary workaround for https://github.com/microsoft/vscode-cpptools/issues/9435
            defines = defines.filter(d => !["__EDG_VERSION__", "__EDG_SIZE_TYPE__", "__EDG_PTRDIFF_TYPE__", "__STDCPP_DEFAULT_NEW_ALIGNMENT__"].includes(d.identifier));

            const lang = LanguageUtils.determineLanguage(uri.fsPath);

            const config: SourceFileConfiguration = {
                compilerPath: "",
                defines: defines.map(d => d.makeString()),
                includePath: includes.map(i => i.absolutePath.toString()),
                forcedInclude: preincludes.map(i => i.absolutePath.toString()),
                intelliSenseMode: "clang-arm",
                standard: lang === "c" ? (tryGetCStandard(defines) ?? "c11") : (tryGetCppStandard(defines) ?? "c++11"),
            };
            return {
                uri: uri,
                configuration: config,
            };
        }));
        const configs: SourceFileConfigurationItem[] = [];
        results.forEach(res => {
            if (res.status === "fulfilled") {
                configs.push(res.value);
            }
        });
        this.api.didChangeCustomBrowseConfiguration(this);
        if (token?.isCancellationRequested) {
            // VSC-301 cpptools has a very strict timeout for providing configs, and violating it means cpptools ignores
            // our response. In that case, we can signal a configuration change to force cpptools to remake the request.
            // Since this result is now cached in thewon't{@link ConfigurationSet}, we won't time out a second time.
            logger.debug("Cpptools timed out waiting for intellisense configuration(s). Requesting a refresh.");
            this.api.didChangeCustomConfiguration(this);
            return [];
        } else {
            return configs;
        }
    }
    canProvideBrowseConfiguration(_token?: Vscode.CancellationToken | undefined): Thenable<boolean> {
        return Promise.resolve(true);
    }
    provideBrowseConfiguration(_token?: Vscode.CancellationToken | undefined): Promise<WorkspaceBrowseConfiguration> {
        const config = this.intellisenseInfoProvider.provideBrowseInfo();
        const includes = config?.includes.concat(config.preincludes ?? []) ?? [];
        const defines = config?.defines ?? [];
        const standard = tryGetCStandard(defines) ?? tryGetCppStandard(defines) ?? "c11";
        return Promise.resolve({
            browsePath: includes?.map(inc => inc.absolutePath.toString()),
            compilerPath: "",
            compilerArgs: [],
            standard,
            windowsSdkVersion: ""
        });
    }
    canProvideBrowseConfigurationsPerFolder(_token?: Vscode.CancellationToken | undefined): Thenable<boolean> {
        return Promise.resolve(false);
    }
    provideFolderBrowseConfiguration(_uri: Vscode.Uri, _token?: Vscode.CancellationToken | undefined): Thenable<WorkspaceBrowseConfiguration | null> {
        return Promise.resolve(null);
    }
    dispose() {
        this.canProvideConfiguration = () => Promise.resolve(false);
        this.output.dispose();
    }
}

type LangStandard = "c89" | "c99" | "c11" | "c17" | "c++98" | "c++03" | "c++11" | "c++14" | "c++17" | "c++20";
// Tries to deduce the c or c++ language standard used for a file, given its preprocessor defines.
function tryGetCStandard(defines: Define[]): LangStandard | undefined {
    const stdcDefine = defines.find(def => def.identifier === "__STDC_VERSION__");
    return stdcDefine && stdcDefine.value ? LANG_STANDARD_DEFINES[stdcDefine.value] : undefined;
}
function tryGetCppStandard(defines: Define[]): LangStandard | undefined {
    const cppDefine = defines.find(def => def.identifier === "__cplusplus");
    return cppDefine && cppDefine.value ? LANG_STANDARD_DEFINES[cppDefine.value] : undefined;
}
const LANG_STANDARD_DEFINES: Record<string, LangStandard> = {
    "199409L": "c89",
    "199901L": "c99",
    "201112L": "c11",
    "201710L": "c17",
    "199711L": "c++03",
    "201103L": "c++11",
    "201402L": "c++14",
    "201703L": "c++17",
    "202002L": "c++20",
};
