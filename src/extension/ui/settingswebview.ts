/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import * as vscode from "vscode";
import * as Fs from "fs";
import { Workbench } from "iar-vsc-common/workbench";
import { ListInputModel, MutableListInputModel } from "../model/model";
import * as sanitizeHtml from "sanitize-html";
import { AddWorkbenchCommand } from "../command/addworkbench";
import { logger } from "iar-vsc-common/logger";
import { Subject } from "rxjs";
import { EwwFile } from "../../iar/workspace/ewwfile";
import { AsyncObservable } from "../../utils/asyncobservable";
import { EwWorkspace } from "../../iar/workspace/ewworkspace";
import { ProjectListModel } from "../model/selectproject";
import { ConfigurationListModel } from "../model/selectconfiguration";

// Make sure this matches the enum in media/settingsview.js! AFAIK we cannot share code between here and the webview javascript
enum MessageSubject {
    WorkbenchSelected = "Workbench",
    WorkspaceSelected = "Workspace",
    ProjectSelected = "Project",
    ConfigSelected = "Config",
    AddWorkbench = "AddWorkbench",
    OpenSettings = "OpenSettings",
    ViewLoaded = "ViewLoaded",
}
export enum DropdownIds {
    Workbench = "workbench",
    Workspace = "workspace",
    Project = "project",
    Configuration = "config",
}

/**
 * A webview in the side panel that lets the user select which workbench, project and configuration to use.
 * The view is constructed using plain html, css and js which run separate from all extension code. The view uses
 * a message-passing system to inform the extension of e.g. the user selecting a new value.
 * For documentation on webviews, see here:
 * https://code.visualstudio.com/api/extension-guides/webview
 */
export class SettingsWebview implements vscode.WebviewViewProvider {

    public static readonly VIEW_TYPE = "iar-configuration";

    private view?: vscode.WebviewView;
    private viewLoaded: Promise<void> | undefined = undefined;
    private workbenchesLoading = false;
    private workspaceLoading = false;
    private currentWorkspace: EwWorkspace | undefined = undefined;

    /**
     * Creates a new view. The caller is responsible for registering it.
     * @param extensionUri The uri of the extension's root directory
     * @param workbenches The workbench list to display and modify
     * @param workspaces The workspace list to display and modify
     * @param workspace The loaded workspace to display and modify
     * @param addWorkbenchCommand The command to call when the user wants to add a new workbench
     * @param workbenchesLoading Notifies when the workbench list is in the process of (re)loading
     */
    constructor(private readonly extensionUri: vscode.Uri,
        private readonly workbenches: MutableListInputModel<Workbench>,
        private readonly workspaces: MutableListInputModel<EwwFile>,
        private readonly workspace: AsyncObservable<EwWorkspace>,
        private readonly addWorkbenchCommand: AddWorkbenchCommand,
        workbenchesLoading: Subject<boolean>,
    ) {
        // Fully redraw the view on any change. Not optimal performance, but seems to be fast enough.
        const changeHandler = this.updateView.bind(this);
        this.workbenches.addOnInvalidateHandler(changeHandler);
        this.workbenches.addOnSelectedHandler(changeHandler);
        this.workspaces.addOnInvalidateHandler(changeHandler);
        this.workspaces.addOnSelectedHandler(changeHandler);

        this.workspace.onValueWillChange(() => {
            this.currentWorkspace = undefined;
            this.workspaceLoading = true;
            changeHandler();
        });
        this.workspace.onValueDidChange(newWorkspace => {
            this.currentWorkspace = newWorkspace;
            this.workspaceLoading = false;
            changeHandler();
            newWorkspace?.projects.addOnSelectedHandler(() => changeHandler());
            newWorkspace?.projectConfigs.addOnSelectedHandler(() => changeHandler());
        });

        workbenchesLoading.subscribe(load => {
            this.workbenchesLoading = load;
            this.updateView();
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
        let onViewLoaded: (() => void) | undefined = undefined;
        this.viewLoaded = new Promise(resolve => onViewLoaded = resolve);
        // These messages are sent by our view (media/settingsview.js)
        this.view.webview.onDidReceiveMessage(async(message: { subject: string, index: number }) => {
            logger.debug(`Message from settings view: ${JSON.stringify(message)}`);
            switch (message.subject) {
            case MessageSubject.WorkbenchSelected:
                this.workbenches.select(message.index);
                break;
            case MessageSubject.WorkspaceSelected:
                this.workspaces.select(message.index);
                break;
            case MessageSubject.ProjectSelected:
                this.currentWorkspace?.projects.select(message.index);
                break;
            case MessageSubject.ConfigSelected:
                if (this.currentWorkspace) {
                    const config = this.currentWorkspace.projectConfigs.items[message.index];
                    if (config) {
                        this.currentWorkspace.projectConfigs.selectWhen(conf => conf.name === config.name);
                    }
                }
                break;
            case MessageSubject.AddWorkbench: {
                const changed = await vscode.commands.executeCommand(this.addWorkbenchCommand.id);
                if (!changed) {
                    // Redraw so workbench dropdown's selected value matches model
                    this.updateView();
                }
                break;
            }
            case MessageSubject.OpenSettings:
                vscode.commands.executeCommand("workbench.action.openSettings", "@ext:iarsystems.iar-build");
                break;
            case MessageSubject.ViewLoaded:
                onViewLoaded?.();
                break;
            default:
                logger.error("Settings view got unknown subject: " + message.subject);
                break;
            }
        });
        this.updateView();
    }

    private updateView() {
        if (this.view === undefined) {
            return;
        }
        this.view.webview.html = Rendering.getWebviewContent(
            this.view.webview,
            this.extensionUri,
            this.workbenches,
            this.workspaces,
            this.currentWorkspace,
            this.workbenchesLoading,
            this.workspaceLoading
        );
    }

    // ! Exposed for testing only.
    awaitViewLoaded() {
        return this.viewLoaded ?? Promise.resolve(new Error("View is not attached"));
    }
    async selectFromDropdown(dropdown: DropdownIds, index: number) {
        if (this.view === undefined) {
            throw new Error("View is not attached");
        }
        await this.viewLoaded;
        this.view.webview.postMessage({subject: "select", target: dropdown, index: index});
    }
}

/**
 * Generates the HTML for the view. The view itself is stateless; the contents are determined entirely from the input parameters
 * to {@link getWebviewContent}. Any UI changes (such as the user selecting another dropdown option) are immediately
 * sent to the extension so that the data model(s) can be updated, and the view is then redrawn from the updated model(s).
 */
namespace Rendering {
    let renderCount = 0;

    export function getWebviewContent(
        webview: vscode.Webview,
        extensionUri: vscode.Uri,
        workbenches: ListInputModel<Workbench>,
        workspaces: ListInputModel<EwwFile>,
        workspace: EwWorkspace | undefined,
        workbenchesLoading: boolean,
        workspaceLoading: boolean,
    ) {
        // load npm packages for standardized UI components and icons
        //! NOTE: ALL files you load here (even indirectly) must be explicitly included in .vscodeignore, so that they are packaged in the .vsix. Webpack will not find these files.
        const toolkitUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "node_modules", "@vscode", "webview-ui-toolkit", "dist", "toolkit.js"));
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "node_modules", "@vscode/codicons", "dist", "codicon.css"));
        // load css and js for the view (in <extension root>/media/).
        const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "settingsview.css"));
        const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "settingsview.js"));

        // To be able to use VS Code's CSS variables (for correct theming), the SVGs must be placed directly in the html.
        // Therefore we read the file contents here instead of generating a webview uri to use in an <img/> tag.
        const loadSvg = (filename: string) => {
            try {
                return Fs.readFileSync(vscode.Uri.joinPath(extensionUri, "media/icons", filename).fsPath, {encoding: "utf8"});
            } catch (e) {
                logger.error("Failed to load icon: " + filename);
                return "";
            }
        };
        const treeL = loadSvg("tree-L.svg");
        const treeIBroken = loadSvg("tree-I-broken.svg");

        const projects = workspace?.projects ?? new ProjectListModel;
        const configs = workspace?.projectConfigs ?? new ConfigurationListModel;

        // install the es6-string-html extension for syntax highlighting here
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
        <link href="${codiconsUri}" rel="stylesheet" />
        <link rel="stylesheet" href="${cssUri}">
        <script src="${jsUri}"></script>
        <title>Extension Configuration</title>
    </head>
    <body>
        <!-- A hacky way to make the html different every draw, and thus force vs code to redraw the view. -->
        <!-- This lets us reset the dropdowns' selected values to match the models, by redrawing the view. -->
        <!-- ${renderCount++} -->
        <div id="contents">
            <div class="section">
                <p>IAR Embedded Workbench or IAR Build Tools installation:</p>
                ${makeDropdown(workbenches, DropdownIds.Workbench, "tools", workbenches.items.length === 0 || workbenchesLoading, "No IAR toolchains found", true, /*html*/`
                    <vscode-divider></vscode-divider>
                    <vscode-option artificial>Add Toolchain...</vscode-option>
                `)}
                <div id="workbench-error" ${workbenches.items.length > 0 || workbenchesLoading ? "hidden" : ""}>
                    <span>No IAR toolchain installations found.</span><vscode-link id="link-add">Add Toolchain</vscode-link>
                </div>
                <vscode-progress-ring ${ !workbenchesLoading ? "hidden" : ""}></vscode-progress-ring>
            </div>
            <div class="section">
                    <p>Workspace, project and configuration:</p>
                    ${makeDropdown(workspaces, DropdownIds.Workspace, "window", workspaces.items.length === 0, "No workspaces found", true)}
                    ${workspaces.selected === undefined ? treeIBroken : ""}
                    <div class="wide-container">
                        ${workspaces.selected === undefined ? "" : treeL}
                        ${makeDropdown(projects, DropdownIds.Project, "symbol-method", projects.items.length === 0 || workspaceLoading, "No projects found", true)}
                    </div>
                    <div class="wide-container">
                        <div class="wide-container${workspaces.selected !== undefined ? " configs" : ""}">
                            ${treeL}
                            ${makeDropdown(configs, DropdownIds.Configuration, "settings-gear", configs.items.length === 0 || workspaceLoading, "No configurations found")}
                        </div>
                    </div>
                    <vscode-progress-ring ${ !workspaceLoading ? "hidden" : ""}></vscode-progress-ring>

            </div>
        </div>

        <div id="footer">
            <vscode-link id="settings-link" class="link">Open Settings</vscode-link>
            <vscode-link href="https://github.com/IARSystems/iar-vsc-build/blob/master/docs/README.md" id="documentation-link" class="link">View Documentation</vscode-link>
        </div>
    </body>
    </html>`;
    }

    function makeDropdown<T>(
        model: ListInputModel<T>,
        id: DropdownIds,
        iconName: string,
        isDisabled: boolean,
        emptyMsg: string,
        useTooltips = false,
        extraOptions?: string,
    ) {
        return /*html*/`
            <div class="wide-container">
                <span class="codicon codicon-${iconName} dropdown-icon ${isDisabled ? "disabled" : ""}"></span>
                <vscode-dropdown id="${id}" class="dropdown" ${isDisabled ? "disabled" : ""}>
                    ${getDropdownOptions(model, emptyMsg, useTooltips)}
                    ${extraOptions ?? ""}
                </vscode-dropdown>
            </div>
        `;
    }

    function getDropdownOptions<T>(model: ListInputModel<T>, emptyMsg: string, useTooltips = false): string {
        if (model.items.length === 0) {
            return `<vscode-option>${emptyMsg}</vscode-option>`;
        }
        let html = "";
        if (model.selectedIndex === undefined) {
            // The 'articifical' attribute tells the ui code to disregard this when calculating selected index
            html += /*html*/`<vscode-option selected artificial>None selected...</vscode-option>`;
        }
        for (let i = 0; i < model.items.length; i++) {
            // Note that we sanitize the labels, since they are user input and could inject HTML.
            html += /*html*/`<vscode-option
                    ${useTooltips && model.detail(i) ? `title="${model.detail(i)}"` : ""}
                    ${model.selectedIndex === i ? "selected" : ""}>
                ${sanitizeHtml(model.label(i), {allowedTags: [], allowedAttributes: {}, disallowedTagsMode: "recursiveEscape"})}
            </vscode-option>`;
        }
        return html;
    }
}
