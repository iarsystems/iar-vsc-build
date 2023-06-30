/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { logger } from "iar-vsc-common/logger";
import * as Vscode from "vscode";
import * as Path from "path";
import { ExtensionState } from "../extensionstate";
import { ExtensionSettings } from "../settings/extensionsettings";
import { WorkspaceIntellisenseProvider } from "./workspaceintellisenseprovider";
import { Define } from "./data/define";
import { IntellisenseInfo } from "./data/intellisenseinfo";
import { FsUtils } from "../../utils/fs";
import { Keyword } from "./data/keyword";
import { RegexUtils } from "../../utils/utils";
import { IarOsUtils } from "iar-vsc-common/osUtils";
import { Config } from "../../iar/project/config";
import { Workbench } from "iar-vsc-common/workbench";

/**
 * Provides intellisense information, such as defines and include paths, for source files in the workspace.
 * The intellisense info is kept up to date automatically. Clients can request intellisense info using
 * {@link getIntellisenseInfoFor}, and can use {@link onIntellisenseInfoChanged} to be notified when the intellisense
 * info should be re-fetched.
 *
 * This class does not do anything with the intellisense information; it is up to the client to forward this implementation
 * to some intellisense implementation (e.g. cpptools).
 */
export class IntellisenseInfoService {
    // This class has three sources of intellisense info:
    // * Project configuration-specific values, e.g. project options & compiler defaults ("workspace intellisense info")
    // * Fake "defines" made to emulate certain extended keywords/compiler intrinsics
    // * Defines from the extension settings
    private workspaceIntellisenseInfo: WorkspaceIntellisenseProvider | undefined = undefined;
    private keywordDefines: Define[] = [];

    private readonly changeListeners: Array<() => void> = [];

    constructor(private readonly output: Vscode.OutputChannel) {
        // Handle various events by refreshing intellisense data that might be outdated.
        // Note that selecting a project also triggers a config selection
        ExtensionState.getInstance().config.addOnSelectedHandler(async() => {
            const project = ExtensionState.getInstance().project.selected;
            const config = ExtensionState.getInstance().config.selected;
            if (!project || !config) {
                return;
            }
            let changed = false;
            await Promise.all([
                this.generateKeywordDefines(),
                this.workspaceIntellisenseInfo?.setConfigurationForProject(project, config).then(didChange => changed = didChange),
            ]);
            if (changed) {
                this.notifyIntellisenseInfoChanged();
            }
        });
        ExtensionState.getInstance().workbench.addOnSelectedHandler(async() => {
            let success = false;
            await Promise.all([
                this.generateKeywordDefines(),
                this.generateWorkspaceIntellisenseInfo().then(didSucceed => success = didSucceed),
            ]);
            if (success) {
                this.notifyIntellisenseInfoChanged();
            }
        });
        ExtensionState.getInstance().project.addOnInvalidateHandler(async() => {
            if (await this.generateWorkspaceIntellisenseInfo()) {
                this.notifyIntellisenseInfoChanged();
            }
        });
        ExtensionSettings.observeSetting(ExtensionSettings.ExtensionSettingsField.Defines, () => {
            this.notifyIntellisenseInfoChanged();
        });
    }

    public onIntellisenseInfoChanged(listener: () => void) {
        this.changeListeners.push(listener);
    }

    public async provideIntellisenseInfoFor(file: string): Promise<IntellisenseInfo> {
        logger.debug(`Providing intellisense configuration for: ${file}`);
        if (this.workspaceIntellisenseInfo === undefined) {
            return Promise.reject(new Error("An intellisense config was requested, but no config is available"));
        }

        const preTimestamp = Date.now();
        try {
            let intellisenseInfo: IntellisenseInfo;
            if (!this.workspaceIntellisenseInfo.canHandleFile(file)) {
                logger.debug(`Using fallback intellisense configuration for '${file}'`);
                intellisenseInfo = this.workspaceIntellisenseInfo.getBrowseInfo();
            } else {
                intellisenseInfo = await this.workspaceIntellisenseInfo.getIntellisenseInfoFor(file);
            }
            const settingsDefines = ExtensionSettings.getDefines().map(stringDefine => Define.fromString(stringDefine)); // user-defined extra macros
            intellisenseInfo.defines = intellisenseInfo.defines.
                concat(this.keywordDefines).
                concat(settingsDefines);

            logger.debug(`Generated intellisense configuration(s) in ${Date.now() - preTimestamp} ms.`);
            return intellisenseInfo;
        } catch (e) {
            if (typeof(e) === "string" || e instanceof Error) {
                logger.error(`Failed to provide intellisense configuration for ${file}: ${e.toString()}`);
            }
            throw e;
        }
    }

    public provideBrowseInfo(): IntellisenseInfo {
        const config = this.workspaceIntellisenseInfo?.getBrowseInfo();
        return {
            defines: config?.defines ?? [],
            includes: config?.includes ?? [],
            preincludes: config?.preincludes ?? [],
        };
    }

    /**
        * Forces the provider to regenerate configurations for all source files.
        * Useful in tests to make sure the configuration has been updated before continuing.
        */
    public async forceUpdate() {
        await Promise.all([
            this.generateKeywordDefines(),
            this.generateWorkspaceIntellisenseInfo(),
        ]);
        this.notifyIntellisenseInfoChanged();
    }

    /**
     * Returns whether this class has intellisense information about a file. Exposed for testing purposes.
     */
    public canHandleFile(file: string) {
        return this.workspaceIntellisenseInfo?.canHandleFile(file) ?? false;
    }

    /**
     * Discards and then regenerates all known per-project intellisense data.
     * Returns true on success.
     */
    private async generateWorkspaceIntellisenseInfo(): Promise<boolean> {
        const workbench = ExtensionState.getInstance().workbench.selected;
        const config = ExtensionState.getInstance().config.selected;
        const project = ExtensionState.getInstance().project.selected;
        const projects = ExtensionState.getInstance().project.projects;
        if (!workbench || !config || !project || !projects) {
            return false;
        }
        const argVarFile = ExtensionState.getInstance().workspace.selected?.getArgvarsFile();
        const workspaceFolder = Vscode.workspace.getWorkspaceFolder(Vscode.Uri.file(project.path))?.uri.fsPath ?? Vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        try {
            this.workspaceIntellisenseInfo = await WorkspaceIntellisenseProvider.loadProjects(projects, workbench, config.name, argVarFile, workspaceFolder, this.output);
            return true;
        } catch (err) {
            this.workspaceIntellisenseInfo = undefined;
            logger.error("Failed to generate intellisense config: " + err);
            // Show error msg with a button to see the logs
            Vscode.window.showErrorMessage("IAR: Failed to generate intellisense configuration: " + err, { title: "Show Output Window"}).then(res => {
                if (res !== undefined) {
                    this.output.show(false);
                }
            });
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
            const blacklist = INTRINSIC_FUNCTIONS[config.targetId] ?? new Set();
            this.keywordDefines = keywords.filter(kw => !blacklist.has(kw.identifier)).map(kw => Keyword.toDefine(kw));
        }
    }

    private notifyIntellisenseInfoChanged() {
        this.changeListeners.forEach(listener => listener());
    }
}

/**
    * Finds the compiler to use for the given config, and returns its path.
    * May return undefined, e.g. if the workbench doesn't have the required target installed.
    */
async function getCompilerForConfig(config: Config, workbench: Workbench): Promise<string | undefined> {
    const toolchainBinDir = Path.join(workbench.path.toString(), config.targetId, "bin");
    const regex = "icc.*" + RegexUtils.escape(IarOsUtils.executableExtension());
    const filter = FsUtils.createFilteredListDirectoryFilenameRegex(new RegExp(regex));
    const compilerPaths = await FsUtils.filteredListDirectory(toolchainBinDir, filter);
    if (compilerPaths[0] !== undefined) {
        if (compilerPaths.length > 1) {
            logger.error(`Found more than one compiler candidate for ${config.targetId} in ${workbench.name}.`);
        }
        return compilerPaths[0].toString();
    }
    logger.error(`Didn't find a compiler for ${config.targetId} in ${workbench.path}.`);
    return undefined;
}

// Instrinsic functions that should not be added as preprocessor macros. They are typically declared as functions in an <intrinsics.h> header
const INTRINSIC_FUNCTIONS: Record<string, Set<string>> = {
    "avr": new Set([
        "__delay_cycles",
        "__disable_interrupt",
        "__enable_interrupt",
        "__extended_load_program_memory",
        "__insert_opcode",
        "__load_program_memory",
        "__no_operation",
        "__restore_interrupt",
        "__save_interrupt",
        "__sleep",
        "__watchdog_reset",
        "__swap_nibbles",
        "__indirect_jump_to",
        "__multiply_unsigned",
        "__multiply_signed",
        "__multiply_signed_with_unsigned",
        "__fractional_multiply_unsigned",
        "__fractional_multiply_signed",
        "__fractional_multiply_signed_with_unsigned",
        "__DataToR0ByteToSPMCR_SPM",
        "__AddrToZByteToSPMCR_SPM",
        "__AddrToZWordToR1R0ByteToSPMCR_SPM",
        "_SPM_LOCKBITS",
        "_SPM_ERASE",
        "_SPM_FILLTEMP",
        "_SPM_PAGEWRITE",
        "__AddrToZByteToSPMCR_LPM",
        "_SPM_GET_LOCKBITS",
        "_SPM_GET_FUSEBITS",
        "__AddrToZ24ByteToSPMCR_SPM",
        "__AddrToZ24WordToR1R0ByteToSPMCR_SPM",
        "_SPM_24_ERASE",
        "_SPM_24_FILLTEMP",
        "_SPM_24_PAGEWRITE",
        "__AddrToZ24ByteToSPMCR_ELPM",
        "__EEPUT",
        "__EEGET",
        "input",
        "output",
        "input_block_dec",
        "input_block_inc",
        "output_block_dec",
        "output_block_inc",
        "__out_word",
        "__out_word_atomic",
        "__in_word",
        "__in_word_atomic",
    ]),
    "rh850": new Set([
        "__asm",
        "__BSH",
        "__BSW",
        "__CAXI",
        "__disable_interrupt",
        "__DST",
        "__enable_interrupt",
        "__EST",
        "__FLOORF_DL",
        "__FLOORF_DUL",
        "__FLOORF_DUW",
        "__FLOORF_DW",
        "__FLOORF_SL",
        "__FLOORF_SUL",
        "__FLOORF_SL",
        "__FLOORF_SUL",
        "__FLOORF_SUW",
        "__FLOORF_SW",
        "__get_interrupt_state",
        "__halt",
        "__HSW",
        "__LDL",
        "__LDSR",
        "__no_operation",
        "__ROUNDF_DL",
        "__ROUNDF_DUL",
        "__ROUNDF_DUW",
        "__ROUNDF_DW",
        "__ROUNDF_SL",
        "__ROUNDF_SUL",
        "__ROUNDF_SUW",
        "__ROUNDF_SW",
        "__saturated_add",
        "__saturated_sub",
        "__SCH0L",
        "__SCH0R",
        "__SCH1L",
        "__SCH1R",
        "__set_interrupt_state",
        "__snooze",
        "__SQRTF_D",
        "__SQRTF_S",
        "__STC",
        "__STSR",
        "__SYNCE",
        "__SYNCI",
        "__SYNCM",
        "__SYNCP",
        "__TLBAI",
        "__TLBR",
        "__TLBS",
        "__TLBVI",
        "__TLBW",
        "__upper_mul64",
        "__DI",
        "__EI",
        "__NOP",
        "__HALT",
        "__SNOOZE",
        "__SATADD",
        "__SATSUB",
        "__get_processor_register",
        "__set_processor_register",
        "__ASM",
        "__search_zeros_left",
        "__search_zeros_right",
        "__search_ones_left",
        "__search_ones_right",
        "__fpu_sqrt_float",
        "__fpu_sqrt_double",
        "__synchronize_exceptions",
        "__synchronize_memory",
        "__synchronize_pipeline",
        "__compare_and_exchange_for_interlock",
        "__DBCP",
        "__DBHVTRAP",
        "__DBPUSH",
        "__DBTAG",
        "__DBTRAP",
        "__RMTRAP",
        "__DBRET",
    ]),
    "rl78": new Set([
        "__disable_interrupt",
        "__enable_interrupt",
        "__get_interrupt_state",
        "__set_interrupt_state",
        "__get_interrupt_level",
        "__set_interrupt_level",
        "__no_operation",
        "__halt",
        "__stop",
        "__break",
        "__low_level_init",
        "__mach",
        "__machu",
        "__rol1b",
        "__rol1w",
        "__ror1b",
        "__ror1w",
    ]),
    "stm8": new Set(["__trap"]),
};