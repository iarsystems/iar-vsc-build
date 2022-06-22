/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Vscode from "vscode";
import { CustomConfigurationProvider, getCppToolsApi, Version, CppToolsApi, SourceFileConfiguration, SourceFileConfigurationItem, WorkspaceBrowseConfiguration } from "vscode-cpptools";
import { ExtensionState } from "../extensionstate";
import { Settings } from "../settings";
import { CancellationToken } from "vscode-jsonrpc";
import { LanguageUtils, RegexUtils } from "../../utils/utils";
import { Workbench } from "iar-vsc-common/workbench";
import { Config } from "../../iar/project/config";
import * as Path from "path";
import { IarOsUtils } from "iar-vsc-common/osUtils";
import { FsUtils } from "../../utils/fs";
import { Keyword } from "./data/keyword";
import { Define } from "./data/define";
import { ConfigurationSet } from "./configurationset";
import { PartialSourceFileConfiguration } from "./data/partialsourcefileconfiguration";
import { logger } from "iar-vsc-common/logger";

/**
 * Provides source file configurations for an IAR project to cpptools via the cpptools typescript api.
 * Also works without the api (e.g. for old versions of vscode/cpptools), in that case it only outputs the c_cpp_properties file
 */
export class IarConfigurationProvider implements CustomConfigurationProvider {
    private static _instance: IarConfigurationProvider | undefined = undefined;
    public static get instance() {
        return IarConfigurationProvider._instance;
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
        if (IarConfigurationProvider._instance) {
            IarConfigurationProvider._instance.close();
        }

        const instance = new IarConfigurationProvider(api);
        IarConfigurationProvider._instance = instance;
    }

    readonly name = "IAR Build";
    readonly extensionId = "iarsystems.iar-build";


    private readonly output: Vscode.OutputChannel = Vscode.window.createOutputChannel("IAR Config Generator");
    private currentConfiguration: ConfigurationSet | undefined = undefined;

    /**
     * Forces the provider to regenerate configurations for all source files
     * @param revealLog Wether to raise focus for the output channel showing the configuration generation logs
     */
    public forceUpdate(revealLog = false) {
        if (revealLog) this.output.show(true);
        return this.onSettingsChanged();
    }

    /**
     * Returns whether a file belongs to the current project. Exposed for testing purposes.
     */
    public isProjectFile(file: string) {
        return this.currentConfiguration?.isFileInProject(file) ?? false;
    }

    /**
     * Unregister and dispose of this provider.
     * Use this instead of calling {@link dispose}; calling this will indirectly call {@link dispose}.
     */
    public close() {
        this.api.dispose();
    }

    // To force cpptools to recognize extended keywords we pretend they're compiler-defined macros
    private keywordDefines: Define[] = [];

    private constructor(private readonly api: CppToolsApi) {
        // Note that changing the project will also trigger a config change
        // Note that we do not return the promise from onSettingsChanged, because the model does not need to wait for it to finish
        ExtensionState.getInstance().config.addOnSelectedHandler(() => {
            this.onSettingsChanged();
        });
        ExtensionState.getInstance().workbench.addOnSelectedHandler(() => {
            this.onSettingsChanged();
        });
        Settings.observeSetting(Settings.ExtensionSettingsField.Defines, this.onSettingsChanged.bind(this));

        this.api.registerCustomConfigurationProvider(this);
        this.api.notifyReady(this);
        this.onSettingsChanged();
    }

    // cpptools api methods
    canProvideConfiguration(uri: Vscode.Uri, _token?: CancellationToken | undefined): Promise<boolean> {
        const lang = LanguageUtils.determineLanguage(uri.fsPath);
        return Promise.resolve(lang !== undefined && this.currentConfiguration !== undefined);
    }
    async provideConfigurations(uris: Vscode.Uri[], _token?: CancellationToken | undefined): Promise<SourceFileConfigurationItem[]> {
        logger.debug(`Providing intellisense configuration(s) for: ${uris.map(u => u.fsPath).join(", ")}`);
        if (this.currentConfiguration === undefined) {
            logger.warn(`Cpptools requested intellisense config, but no config has been loaded`);
            return [];
        }

        const results = await Promise.allSettled(uris.map(async(uri) => {
            if (!this.currentConfiguration) {
                return Promise.reject(new Error("No intellisense configuration loaded"));
            }
            try {
                let partialConfig: PartialSourceFileConfiguration;
                if (!this.currentConfiguration.isFileInProject(uri.fsPath)) {
                    logger.debug(`Using fallback intellisense configuration for '${uri.fsPath}'`);
                    partialConfig = this.currentConfiguration.getFallbackConfiguration();
                } else {
                    partialConfig = await this.currentConfiguration.getConfigurationFor(uri.fsPath);
                }
                const includes = partialConfig.includes;
                let defines = partialConfig.defines;
                defines = defines.concat(this.keywordDefines);
                const preincludes = partialConfig.preincludes;

                let stringDefines = defines.map(d => d.makeString());
                stringDefines = Settings.getDefines().concat(stringDefines); // user-defined extra macros
                const lang = LanguageUtils.determineLanguage(uri.fsPath);

                const config: SourceFileConfiguration = {
                    // VSC-290 allowed MSVC-style unnamed unions/structs
                    compilerArgs: ["-fms-extensions", "-fno-builtin"],
                    defines: stringDefines,
                    includePath: includes.map(i => i.absolutePath.toString()),
                    forcedInclude: preincludes.map(i => i.absolutePath.toString()),
                    intelliSenseMode: "clang-arm",
                    standard: lang === "c" ? (tryGetCStandard(defines) ?? "c11") : (tryGetCppStandard(defines) ?? "c++11"),
                };
                return {
                    uri: uri,
                    configuration: config,
                };
            } catch (e) {
                if (typeof(e) === "string" || e instanceof Error) {
                    logger.error(`Failed to provide intellisense configuration for ${uri.fsPath}: ${e.toString()}`);
                }
                throw e;
            }
        }));
        const configs: SourceFileConfigurationItem[] = [];
        results.forEach(res => {
            if (res.status === "fulfilled") {
                configs.push(res.value);
            }
        });
        this.api.didChangeCustomBrowseConfiguration(this);
        return configs;
    }
    canProvideBrowseConfiguration(_token?: CancellationToken | undefined): Thenable<boolean> {
        return Promise.resolve(true);
    }
    provideBrowseConfiguration(_token?: CancellationToken | undefined): Promise<WorkspaceBrowseConfiguration> {
        const config = this.currentConfiguration?.getFallbackConfiguration();
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
    canProvideBrowseConfigurationsPerFolder(_token?: CancellationToken | undefined): Thenable<boolean> {
        return Promise.resolve(false);
    }
    provideFolderBrowseConfiguration(_uri: Vscode.Uri, _token?: CancellationToken | undefined): Thenable<WorkspaceBrowseConfiguration | null> {
        return Promise.resolve(null);
    }
    dispose() {
        this.canProvideConfiguration = () => Promise.resolve(false);
        this.output.dispose();
    }

    // returns true if configs changed
    private async generateSourceConfigs(): Promise<boolean> {
        const workbench = ExtensionState.getInstance().workbench.selected;
        const config = ExtensionState.getInstance().config.selected;
        const project = ExtensionState.getInstance().project.selected;
        if (!workbench || !config || !project) {
            return false;
        }
        logger.debug(`Generating intellisense config for '${project.name}':'${config.name}'...`);
        const workspaceFolder = Vscode.workspace.getWorkspaceFolder(Vscode.Uri.file(project.path))?.uri.fsPath ?? Vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        try {
            this.currentConfiguration = await ConfigurationSet.loadFromProject(project, config, workbench, workspaceFolder, this.output);
            return true;
        } catch (err) {
            this.currentConfiguration = undefined;
            const extWb = await ExtensionState.getInstance().extendedWorkbench.getValue();
            // If the selected workbench doesn't support the selected config's toolchain, don't show an error msg; we can show a more helpful error message elsewhere.
            const suppressErrors = extWb && !(await extWb.getToolchains()).some(tc => tc.id === config.toolchainId);
            if (!suppressErrors) {
                logger.error("Failed to generate intellisense config: " + err);
                // Show error msg with a button to see the logs
                Vscode.window.showErrorMessage("IAR: Failed to generate intellisense configuration: " + err, { title: "Show Output Window"}).then(res => {
                    if (res !== undefined) {
                        this.output.show(false);
                    }
                });
            }
            return false;
        }
    }


    private async generateKeywordDefines() {
        const workbench = ExtensionState.getInstance().workbench.selected;
        const config = ExtensionState.getInstance().config.selected;
        if (!workbench || !config) {
            return;
        }
        const compiler = await getCompilerForConfig(config, workbench);
        if (!compiler) {
            return;
        }
        // C syntax files are named <platform dir>/config/syntax_icc.cfg
        const platformBasePath = Path.join(Path.dirname(compiler), "..");
        const filePath         = platformBasePath + "/config/syntax_icc.cfg";
        if (await FsUtils.exists(filePath)) {
            const keywords = await Keyword.fromSyntaxFile(filePath);
            const blacklist = INTRINSIC_FUNCTIONS[config.toolchainId.toLowerCase()] ?? new Set();
            this.keywordDefines = keywords.filter(kw => !blacklist.has(kw.identifier)).map(kw => Keyword.toDefine(kw));
        }
    }

    private async onSettingsChanged(): Promise<void> {
        let changed = false;
        await Promise.all([
            this.generateKeywordDefines(),
            this.generateSourceConfigs().then(didChange => changed = didChange),
        ]);
        if (changed) {
            logger.debug("Intellisense config changed. Notifying cpptools.");
            this.api.didChangeCustomConfiguration(this);
            this.api.didChangeCustomBrowseConfiguration(this);
        }
    }
}

/**
 * Finds the compiler to use for the given config, and returns its path.
 * May return undefined, e.g. if the workbench doesn't have the required target installed.
 */
async function getCompilerForConfig(config: Config, workbench: Workbench): Promise<string | undefined> {
    const toolchainBinDir = Path.join(workbench.path.toString(), config.toolchainId.toLowerCase(), "bin");
    const regex = "icc.*" + RegexUtils.escape(IarOsUtils.executableExtension());
    const filter = FsUtils.createFilteredListDirectoryFilenameRegex(new RegExp(regex));
    const compilerPaths = await FsUtils.filteredListDirectory(toolchainBinDir, filter);
    if (compilerPaths[0] !== undefined) {
        if (compilerPaths.length > 1) {
            logger.error(`Found more than one compiler candidate for ${config.toolchainId} in ${workbench}.`);
        }
        return compilerPaths[0].toString();
    }
    logger.error(`Didn't find a compiler for ${config.toolchainId} in ${workbench.path}.`);
    return undefined;
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

// Instrinsic functions that should not be added as preprocessor macros. They are typically declared as functions in an <intrinsics.h> header
const INTRINSIC_FUNCTIONS: Record<string, Set<string>> = {
    "rh850": new Set([
        "__disable_interrupt",
        "__enable_interrupt",
        "__no_operation",
        "__halt",
        "__snooze",
        "__saturated_add",
        "__saturated_sub",
        "__STSR",
        "__LDSR",
        "__set_interrupt_state",
        "__upper_mul64",
        "__LDL",
        "__STC",
        "__SCH0L",
        "__SCH0R",
        "__SCH1L",
        "__SCH1R",
        "__BSH",
        "__BSW",
        "__HSW",
        "__SYNCE",
        "__SYNCI",
        "__SYNCM",
        "__SYNCP",
        "__CAXI",
        "__EST",
        "__DST",
        "__TLBAI",
        "__TLBR",
        "__TLBS",
        "__TLBVI",
        "__TLBW",
        "__DBCP",
        "__DBHVTRAP",
        "__DBPUSH",
        "__DBTAG",
        "__DBTRAP",
        "__RMTRAP",
        "__DBRET",
        "__CEILF_SW",
        "__FLOORF_SW",
        "__ROUNDF_SW",
        "__TRNCF_SW",
        "__CEILF_SL",
        "__FLOORF_SL",
        "__ROUNDF_SL",
        "__TRNCF_SL",
        "__CEILF_SUW",
        "__FLOORF_SUW",
        "__ROUNDF_SUW",
        "__TRNCF_SUW",
        "__CEILF_SUL",
        "__FLOORF_SUL",
        "__ROUNDF_SUL",
        "__TRNCF_SUL",
        "__RECIPF_S",
        "__RSQRTF_S",
        "__SQRTF_S",
        "__MADDF_S",
        "__MSUBF_S",
        "__NMADDF_S",
        "__NMSUBF_S",
        "__CEILF_DW",
        "__FLOORF_DW",
        "__ROUNDF_DW",
        "__TRNCF_DW",
        "__CEILF_DL",
        "__FLOORF_DL",
        "__ROUNDF_DL",
        "__TRNCF_DL",
        "__CEILF_DUW",
        "__FLOORF_DUW",
        "__ROUNDF_DUW",
        "__TRNCF_DUW",
        "__CEILF_DUL",
        "__FLOORF_DUL",
        "__ROUNDF_DUL",
        "__TRNCF_DUL",
        "__RECIPF_D",
        "__RSQRTF_D",
        "__SQRTF_D",
    ]),
};