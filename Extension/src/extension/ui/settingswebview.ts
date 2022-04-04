import { Subject } from "rxjs";
import * as vscode from "vscode";
import { Config } from "../../iar/project/config";
import { Project } from "../../iar/project/project";
import { Workbench } from "../../../utils/workbench";
import { ListInputModel } from "../model/model";
import * as sanitizeHtml from "sanitize-html";
import { AddWorkbenchCommand } from "../command/addworkbench";

// Make sure this matches the enum in media/settingsview.js! AFAIK we cannot share code between here and the webview javascript
enum MessageSubject {
    WorkbenchSelected = "Workbench",
    ProjectSelected = "Project",
    ConfigSelected = "Config",
    AddWorkbench = "AddWorkbench",
    OpenSettings = "OpenSettings",
}
export enum DropdownIds {
    Workbench = "workbench",
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

    public static readonly VIEW_TYPE = "iar-settings";

    private view?: vscode.WebviewView;
    private isLoading = false;

    /**
     * Creates a new view. The caller is responsible for registering it.
     * @param extensionUri The uri of the extension's root directory
     * @param workbenches The workbench list to display and modify
     * @param projects The project list to display and modify
     * @param configs The configuration list to display and modify
     * @param addWorkbenchCommand The command to call when the user wants to add a new workbench
     * @param loading A subject notifying when a project is loading
     */
    constructor(private readonly extensionUri: vscode.Uri,
        private readonly workbenches: ListInputModel<Workbench>,
        private readonly projects: ListInputModel<Project>,
        private readonly configs: ListInputModel<Config>,
        private readonly addWorkbenchCommand: AddWorkbenchCommand,
        loading: Subject<boolean>,
    ) {
        // Fully redraw the view on any change. Not optimal performance, but seems to be fast enough.
        const changeHandler = this.updateView.bind(this);
        this.workbenches.addOnInvalidateHandler(changeHandler);
        this.workbenches.addOnSelectedHandler(changeHandler);
        this.projects.addOnInvalidateHandler(changeHandler);
        this.projects.addOnSelectedHandler(changeHandler);
        this.configs.addOnInvalidateHandler(changeHandler);
        this.configs.addOnSelectedHandler(changeHandler);

        loading.subscribe(load => {
            this.isLoading = load;
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
        // These messages are sent by our view (media/settingsview.js)
        this.view.webview.onDidReceiveMessage(async(message: {subject: string, index: number }) => {
            console.log(message);
            switch (message.subject) {
            case MessageSubject.WorkbenchSelected:
                this.workbenches.select(message.index);
                break;
            case MessageSubject.ProjectSelected:
                this.projects.select(message.index);
                break;
            case MessageSubject.ConfigSelected:
                this.configs.select(message.index);
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
            default:
                console.error("Settings view got unknown subject: " + message.subject);
                break;
            }
        });
        this.updateView();
    }

    private updateView() {
        if (this.view === undefined) {
            return;
        }
        this.view.webview.html = Rendering.getWebviewContent(this.view.webview, this.extensionUri, this.isLoading, this.workbenches, this.projects, this.configs);
    }

    // ! Exposed for testing only. Selects a specific option from a dropdown.
    selectFromDropdown(dropdown: DropdownIds, index: number) {
        if (this.view === undefined) {
            throw new Error("View is not attached");
        }
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
        isLoading: boolean,
        workbenches: ListInputModel<Workbench>,
        projects: ListInputModel<Project>,
        configs: ListInputModel<Config>
    ) {
        // load npm packages for standardized UI components and icons
        //! NOTE: ALL files you load here (even indirectly) must be explicitly included in .vscodeignore, so that they are packaged in the .vsix. Webpack will not find these files.
        const toolkitUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "node_modules", "@vscode", "webview-ui-toolkit", "dist", "toolkit.js"));
        const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "node_modules", "@vscode/codicons", "dist", "codicon.css"));
        // load css and js for the view (in <extension root>/media/).
        const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "settingsview.css"));
        const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "settingsview.js"));

        // install the es6-string-html extension for syntax highlighting here
        return /*html*/`<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
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
                <div class="dropdown-container">
                    <span class="codicon codicon-tools dropdown-icon"></span>
                    <vscode-dropdown id="${DropdownIds.Workbench}" class="dropdown" ${workbenches.amount === 0 ? "disabled" : ""}>
                        ${getDropdownOptions(workbenches, "No IAR toolchains")}
                        <vscode-divider></vscode-divider>
                        <vscode-option>Add Toolchain...</vscode-option>
                    </vscode-dropdown>
                </div>
                <div id="workbench-error" ${workbenches.amount > 0 ? "hidden" : ""}>
                    <span>No IAR toolchain installations found.</span><vscode-link id="link-add">Add Toolchain</vscode-link>
                </div>
            </div>
            <div class="section">
                    <p>Active Project and Configuration:</p>
                    <div class="dropdown-container">
                        <span class="codicon codicon-symbol-method dropdown-icon"></span>
                        <vscode-dropdown id="${DropdownIds.Project}" class="dropdown" ${projects.amount === 0 ? "disabled" : ""}>
                            ${getDropdownOptions(projects, "No projects")}
                        </vscode-dropdown>
                    </div>
                    <div class="dropdown-container">
                        <span class="codicon codicon-settings-gear dropdown-icon"></span>
                        <vscode-dropdown id="${DropdownIds.Configuration}" class="dropdown" ${configs.amount === 0 || isLoading ? "disabled" : ""}>
                            ${getDropdownOptions(configs, "No configurations")}
                        </vscode-dropdown>
                    </div>
                <vscode-progress-ring id="config-spinner" ${isLoading ? "" : "hidden"}></vscode-progress-ring>
            </div>
        </div>

        <div id="footer">
            <vscode-link id="settings-link" class="link">Open Settings</vscode-link>
            <!-- TODO: Change this url -->
            <vscode-link href="https://iar-vsc.readthedocs.io/en/latest/index.html" id="documentation-link" class="link">View Documentation (TODO: change url!)</vscode-link>
        </div>
    </body>
    </html>`;
    }

    function getDropdownOptions<T>(model: ListInputModel<T>, emptyMsg: string): string {
        if (model.amount === 0) {
            return `<vscode-option>${emptyMsg}</vscode-option>`;
        }
        let html = "";
        for (let i = 0; i < model.amount; i++) {
            // Note that we sanitize the labels, since they are user input and could inject HTML.
            html += /*html*/`<vscode-option ${model.selectedIndex === i ? "selected" : ""}>
                ${sanitizeHtml(model.label(i), {allowedTags: [], allowedAttributes: {}, disallowedTagsMode: "recursiveEscape"})}
            </vscode-option>`;
        }
        return html;
    }
}
