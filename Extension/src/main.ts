'use strict';


import * as vscode from 'vscode';
import { UI } from './extension/ui/app';
import { ToolManager } from './iar/tools/manager';
import { Settings } from './extension/settings';

export function activate(context: vscode.ExtensionContext) {
    UI.init(context, IarVsc.toolManager);

    UI.getInstance().show();

    let roots = Settings.getIarInstallDirectories();

    roots.forEach(path => {
        IarVsc.toolManager.collectFrom(path);
    });
}

export function deactivate() {
}

namespace IarVsc {
    export let toolManager = ToolManager.createIarToolManager();
}
