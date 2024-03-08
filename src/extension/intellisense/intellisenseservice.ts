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
import { EwWorkspace } from "../../iar/workspace/ewworkspace";
import { ErrorUtils } from "../../utils/utils";

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
    private activeWorkspace: EwWorkspace | undefined = undefined;
    // Per-target defines for extended keywords
    private readonly keywordDefines: Map<string, Define[]> = new Map;

    private readonly changeListeners: Array<() => void> = [];

    constructor(private readonly output: Vscode.OutputChannel) {
        // Handle various events by refreshing intellisense data that might be outdated.
        ExtensionState.getInstance().workbenches.addOnSelectedHandler(() => {
            this.keywordDefines.clear();
            // No need to notify of this change, selecting a workbench will
            // cause a workspace load, which will trigger a full reload below.
        });
        ExtensionState.getInstance().workspace.onValueWillChange(() => {
            this.activeWorkspace = undefined;
            this.workspaceIntellisenseInfo = undefined;
        });
        ExtensionState.getInstance().workspace.onValueDidChange(async(workspace) => {
            this.activeWorkspace = workspace;
            if (workspace) {
                workspace.onActiveConfigChanged(async(project, config) => {
                    if (config && this.activeWorkspace === workspace) {
                        const changed = await this.workspaceIntellisenseInfo?.setConfigurationForProject(project, config);
                        if (changed) {
                            this.notifyIntellisenseInfoChanged();
                        }
                    }
                });
                workspace.projects.items.forEach(project => project.addOnChangeListener(async() => {
                    if (this.activeWorkspace === workspace) {
                        const activeConfig = this.workspaceIntellisenseInfo?.getActiveConfiguration(project);
                        if (!activeConfig || !project.findConfiguration(activeConfig.name)) {
                            // Our active configuration was removed from the project.
                            // We will update when we get an 'onActiveConfigChanged' instead.
                            return;
                        }
                        if (await this.workspaceIntellisenseInfo?.reloadProject(project)) {
                            this.notifyIntellisenseInfoChanged();
                        }
                    }
                }));

                workspace.projects.addOnSelectedHandler(() => {
                    if (this.activeWorkspace === workspace && workspace.projects.selected) {
                        this.workspaceIntellisenseInfo?.setPreferredProject(workspace.projects.selected);
                        this.notifyIntellisenseInfoChanged();
                    }
                });

                if (await this.generateWorkspaceIntellisenseInfo(workspace)) {
                    this.notifyIntellisenseInfoChanged();
                }
            } else {
                this.workspaceIntellisenseInfo = undefined;
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

            let keywordDefines: Define[] = [];
            let targetId = this.workspaceIntellisenseInfo.getTargetIdForFile(file);
            // If the file is unknown we don't know what target to use, so just guess.
            targetId ??= this.activeWorkspace?.getActiveConfig()?.targetId;
            if (targetId) {
                if (!this.keywordDefines.has(targetId)) {
                    await this.generateKeywordDefinesFor(targetId);
                }
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                keywordDefines = this.keywordDefines.get(targetId) ?? [];
            }
            const settingsDefines = ExtensionSettings.getDefines().map(stringDefine => Define.fromString(stringDefine)); // user-defined extra macros
            intellisenseInfo.defines = intellisenseInfo.defines.
                concat(keywordDefines).
                concat(settingsDefines);

            logger.debug(`Generated intellisense configuration(s) in ${Date.now() - preTimestamp} ms.`);
            return intellisenseInfo;
        } catch (e) {
            logger.error(`Failed to provide intellisense configuration for ${file}: ${ErrorUtils.toErrorMessage(e)}`);
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
        if (!this.activeWorkspace) {
            return;
        }

        this.keywordDefines.clear();
        await this.generateWorkspaceIntellisenseInfo(this.activeWorkspace);
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
    private generateWorkspaceIntellisenseInfo(workspace: EwWorkspace): Promise<boolean> {
        const workbench = ExtensionState.getInstance().workbenches.selected;
        if (!workbench) {
            return Promise.resolve(false);
        }

        // Try to decide which vs code workspace to use as working directory
        let workspaceFolder: string | undefined =  undefined;
        const workingPath = workspace?.path ?? workspace?.projects.selected?.path;
        if (workingPath) {
            workspaceFolder =
                Vscode.workspace.getWorkspaceFolder(Vscode.Uri.file(workingPath))?.uri.fsPath ??
                Vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        }

        const loadPromise = WorkspaceIntellisenseProvider.loadWorkspace(
            workspace,
            workbench,
            workspaceFolder,
            this.output);

        return loadPromise.then(intellisenseInfo => {
            if (this.activeWorkspace === workspace) {
                this.workspaceIntellisenseInfo = intellisenseInfo;
                this.workspaceIntellisenseInfo.setPreferredProject(workspace.projects.selected);
                return true;
            }
            return false;
        }).catch(err => {
            if (this.activeWorkspace === workspace) {
                this.workspaceIntellisenseInfo = undefined;
            }
            logger.error("Failed to generate intellisense config: " + err);
            // Show error msg with a button to see the logs
            Vscode.window.showErrorMessage("IAR: Failed to generate intellisense configuration: " + err, { title: "Show Output Window"}).then(res => {
                if (res !== undefined) {
                    this.output.show(false);
                }
            });
            return false;
        });
    }

    private async generateKeywordDefinesFor(targetId: string) {
        const workbench = ExtensionState.getInstance().workbenches.selected;
        if (!workbench) {
            return;
        }

        // C syntax files are named <platform dir>/config/syntax_icc.cfg
        const syntaxFile = Path.join(workbench.path.toString(), targetId, "config/syntax_icc.cfg");
        if (await FsUtils.exists(syntaxFile)) {
            const keywords = await Keyword.fromSyntaxFile(syntaxFile);
            const blacklist = INTRINSIC_FUNCTIONS[targetId] ?? new Set();
            this.keywordDefines.set(targetId,
                keywords.filter(kw => !blacklist.has(kw.identifier)).map(kw => Keyword.toDefine(kw)));
        }
    }

    private notifyIntellisenseInfoChanged() {
        this.changeListeners.forEach(listener => listener());
    }
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