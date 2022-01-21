import * as vscode from "vscode";

export class SettingsWebview implements vscode.WebviewViewProvider {

    public static readonly VIEW_TYPE = "iar-settings";

    private view?: vscode.WebviewView;

    constructor(private readonly extensionUri: vscode.Uri) {
    }

    resolveWebviewView(webviewView: vscode.WebviewView, _context: vscode.WebviewViewResolveContext<unknown>, _token: vscode.CancellationToken): void | Thenable<void> {
        this.view = webviewView;

        this.view.webview.options = {
            enableScripts: true,

            localResourceRoots: [
                this.extensionUri
            ]
        };
        this.view.webview.html = getWebviewContent(this.view.webview, this.extensionUri, true);
    }

}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, isLoading: boolean) {
    const toolkitUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "node_modules", "@vscode", "webview-ui-toolkit", "dist", "toolkit.js"));
    const codiconsUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "node_modules", "@vscode/codicons", "dist", "codicon.css"));
    // install the es6-string-html extension for syntax highlighting here
    return /*html*/`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <script type="module" src="${toolkitUri}"></script>
    <link href="${codiconsUri}" rel="stylesheet" />
    <title>Extension Configuration</title>
    <style>
        #documentation-link {
            position: absolute;
            bottom: 1em;
        }
        #config-spinner {
            margin-top: .6em;
        }
        .section {
            margin-bottom: 2em;
        }
        .dropdown {
            width: 100%;
        }
        .dropdown-label {
            margin-bottom: .1em;
        }
    </style>
</head>
<body>
    <div class="section">
        <p class="dropdown-label">Embedded Workbench Installation:</p>
        <vscode-dropdown class="dropdown">
            <vscode-option>Embedded Workbench 8.0</vscode-option>
            <vscode-option>Embedded Workbench 9.0</vscode-option>
            <vscode-option>Debug</vscode-option>
            <vscode-divider></vscode-divider>
            <vscode-option>Add Workbench...</vscode-option>
        </vscode-dropdown>
    </div>
    <div class="section">
        <p class="dropdown-label" style="display: inline">Project:</p>
        <vscode-dropdown class="dropdown">
            <vscode-option>BasicDebugging</vscode-option>
            <vscode-option>LedFlasher</vscode-option>
        </vscode-dropdown>
        <p class="dropdown-label">Project Configuration:</p>
        <vscode-dropdown class="dropdown" ${isLoading ? "disabled" : ""}>
            <vscode-option>Debug</vscode-option>
            <vscode-option>Release</vscode-option>
        </vscode-dropdown>
        <vscode-progress-ring id="config-spinner" ${isLoading ? "" : "hidden"}></vscode-progress-ring>
    </div>
    <div class="section">
        <vscode-button ${isLoading ? "disabled" : ""}><span class="codicon codicon-tools"></span>Build</vscode-button>
        <vscode-button ${isLoading ? "disabled" : ""}><span class="codicon codicon-trash"></span>Clean</vscode-button>
    </div>

    <!-- TODO: Change this url -->
    <vscode-link href="https://iar-vsc.readthedocs.io/en/latest/index.html" id="documentation-link">IAR: View Documentation (TODO: change url!)</vscode-link>
</body>
</html>`;
}
