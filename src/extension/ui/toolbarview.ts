/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { logger } from "iar-vsc-common/logger";
import * as vscode from "vscode";
import * as Fs from "fs/promises";
import { BuildTasks } from "../task/buildtasks";
import { CStatTaskProvider } from "../task/cstat/cstattaskprovider";
import { OpenTasks } from "../task/opentasks";
import { ExtensionSettings } from "../settings/extensionsettings";
import { ConfigureCommand } from "../command/configure";
import { ExtensionState } from "../extensionstate";

// Maps button id:s to the task they should run
const buttonToTaskMap: Record<string, string> = {
    "btn-build": BuildTasks.TaskNames.Build,
    "btn-rebuild": BuildTasks.TaskNames.Rebuild,
    "btn-clean": BuildTasks.TaskNames.Clean,
    "btn-open": OpenTasks.OPEN_TASK_NAME,
    "btn-analyze": CStatTaskProvider.TaskNames.Run,
    "btn-clear": CStatTaskProvider.TaskNames.Clear,
    "btn-full-report": CStatTaskProvider.TaskNames.FullReport,
    "btn-summary-report": CStatTaskProvider.TaskNames.SummaryReport,
};

/**
 * A view displaying two rows of buttons, each running one of the extension's tasks
 * with default parameters.
 */
export class ToolbarWebview implements vscode.WebviewViewProvider {

    public static readonly VIEW_TYPE = "iar-toolbar";

    private view?: vscode.WebviewView;

    private showCstatIcons = true;
    private showConfigureIcon = false;

    /**
     * Creates a new view. The caller is responsible for registering it.
     * @param extensionUri The uri of the extension's root directory
     */
    constructor(private readonly extensionUri: vscode.Uri) {
        ExtensionState.getInstance().workspace.onValueDidChange(workspace => {
            this.showConfigureIcon = false;

            if (workspace && workspace.isExtendedWorkspace()) {
                workspace.projects.addOnSelectedHandler(async() => {
                    const proj = await workspace.getExtendedProject();
                    this.showConfigureIcon = proj !== undefined && await proj.isCmakeOrCmsisProject();
                    this.updateView();
                });
            } else {
                this.showConfigureIcon = false;
                this.updateView();
            }
        });
    }

    // Called by vscode before the view is shown
    resolveWebviewView(webviewView: vscode.WebviewView, _context: vscode.WebviewViewResolveContext<unknown>, _token: vscode.CancellationToken): void | Thenable<void> {
        this.view = webviewView;
        this.view.onDidDispose(() => {
            this.view = undefined;
        });

        this.view.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.extensionUri, "media"),
                vscode.Uri.joinPath(this.extensionUri, "node_modules"),
            ]
        };
        // These messages are sent by our view (media/toolbarview.js)
        this.view.webview.onDidReceiveMessage(async(message: {id: string}) => {
            if (message.id === "btn-configure") {
                vscode.commands.executeCommand(ConfigureCommand.ID);
                return;
            }

            const taskName = buttonToTaskMap[message.id];
            if (taskName === undefined) {
                logger.error("Could not find task to run for button " + message.id);
                return;
            }
            const toRun = await vscode.tasks.fetchTasks().then(tasks => tasks.find(task => task.name === taskName));
            if (toRun === undefined) {
                logger.error("Could not find task to run with name " + taskName);
                return;
            }
            vscode.tasks.executeTask(toRun);
        });

        this.showCstatIcons = ExtensionSettings.getCstatShowInToolbar();
        ExtensionSettings.observeSetting(ExtensionSettings.ExtensionSettingsField.CstatShowInToolbar, () => {
            this.showCstatIcons = ExtensionSettings.getCstatShowInToolbar();
            this.updateView();
        });

        return this.updateView();
    }

    private async updateView() {
        if (this.view === undefined) {
            return;
        }
        this.view.webview.html = await Rendering.getWebviewContent(this.view.webview, this.extensionUri, this.showCstatIcons, this.showConfigureIcon);
    }
}

namespace Rendering {
    export async function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, showCstatIcons: boolean, showConfigureIcon: boolean) {
        //! NOTE: ALL files you load here (even indirectly) must be explicitly included in .vscodeignore, so that they are packaged in the .vsix. Webpack will not find these files.
        const toolkitUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "node_modules", "@vscode", "webview-ui-toolkit", "dist", "toolkit.js"));
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "node_modules", "@vscode/codicons", "dist", "codicon.css"));
        // load css and js for the view (in <extension root>/media/).
        const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "toolbarview.css"));
        const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "toolbarview.js"));

        // To be able to use VS Code's CSS variables (for correct theming), the SVGs must be placed directly in the html.
        // Therefore we read the file contents here instead of generating a webview uri to use in an <img/> tag.
        const loadSvg = (filename: string) => Fs.readFile(vscode.Uri.joinPath(extensionUri, "media", "icons", filename).fsPath, {encoding: "utf8"});
        const iconBuild = await loadSvg("Build.svg");
        const iconRebuild = await loadSvg("Project-Rebuild-All.svg");
        const iconClean = await loadSvg("Project-Clean.svg");
        const iconOpen = await loadSvg("open-workspace.svg");
        const iconRunCstat = await loadSvg("C-STAT-Analyze-Project.svg");
        const iconClearCstat = await loadSvg("C-STAT-Clear-Analysis-Results.svg");
        const iconGenerateCstatReport = await loadSvg("C-STAT-Generate-HTML-Summary.svg");
        const iconGenerateCstatSummary = await loadSvg("C-STAT-Generate-HTML-Summary_1.svg");

        return /*html*/`<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none';
                        font-src ${webview.cspSource};
                        img-src ${webview.cspSource};
                        frame-src ${webview.cspSource};
                        script-src ${webview.cspSource};
                        style-src ${webview.cspSource};">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script type="module" src="${toolkitUri}"></script>
            <link rel="stylesheet" href="${codiconsUri}">
            <link rel="stylesheet" href="${cssUri}">
            <script src="${jsUri}"></script>
            <title>Quick Actions</title>
        </head>
        <body>
            <div id="outer" class="center-contents">
                <div class="center-contents">
                    <div class="center-contents segment">
                        ${makeButton("btn-build",   iconBuild, "Run Task: Build Project")}
                        ${makeButton("btn-rebuild", iconRebuild,         "Run Task: Rebuild Project")}
                        ${makeButton("btn-clean",   iconClean,           "Run Task: Clean Project")}
                        ${makeButton("btn-open",    iconOpen,   "Run Task: Open Workspace in IAR Embedded Workbench")}
                        <tooltip-container class="${showConfigureIcon ? "" : "hidden"}">
                            <button aria-label="Configure Project" id="btn-configure" class="task-button icon-button tooltip-trigger">
                                <span class="codicon codicon-combine"></span>
                            </button>
                            <div class="tooltip-popup">
                                <div role="tooltip" class="tooltip-popup-content">
                                    Configure Project
                                </div>
                            </div>
                        </tooltip-container>
                    </div>
                ${!showCstatIcons ? "" : /*html*/`
                    <vscode-divider class="divider"></vscode-divider>
                    <div class="center-contents segment">
                        ${makeButton("btn-analyze",        iconRunCstat, "Run Task: Run C-STAT Analysis")}
                        ${makeButton("btn-clear",          iconClearCstat, "Run Task: Clear C-STAT Diagnostics")}
                        ${makeButton("btn-full-report",    iconGenerateCstatReport, "Run Task: Generate Full HTML Report")}
                        ${makeButton("btn-summary-report", iconGenerateCstatSummary, "Run Task: Generate HTML Summary")}
                    </div>
                `}
                </div>
            </div>
        </body>
        </html>`;

        function makeButton(id: keyof typeof buttonToTaskMap, svgIcon: string, description: string) {
            return /*html*/`
                <tooltip-container>
                    <button aria-label="${description}" id="${id}" class="task-button icon-button tooltip-trigger">
                        ${svgIcon}
                    </button>
                    <div class="tooltip-popup">
                        <div role="tooltip" class="tooltip-popup-content">
                            ${description}
                        </div>
                    </div>
                </tooltip-container>
            `;
        }
    }
}