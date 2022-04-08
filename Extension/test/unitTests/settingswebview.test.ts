/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { JSDOM } from "jsdom";
import { BehaviorSubject, Subject } from "rxjs";
import * as vscode from "vscode";
import * as Assert from "assert";
import { AddWorkbenchCommand } from "../../src/extension/command/addworkbench";
import { ConfigurationListModel } from "../../src/extension/model/selectconfiguration";
import { ProjectListModel } from "../../src/extension/model/selectproject";
import { WorkbenchListModel } from "../../src/extension/model/selectworkbench";
import { DropdownIds, SettingsWebview } from "../../src/extension/ui/settingswebview";
import { Workbench, WorkbenchType } from "../../utils/workbench";
import { Config } from "../../src/iar/project/config";
import { Project } from "../../src/iar/project/project";
import { ListInputModel, ListInputModelBase } from "../../src/extension/model/model";
import { ToolManager } from "../../src/iar/tools/manager";

namespace Utils {
    // A fake view we can receive html to, and then inspect it.
    export function createMockView(): vscode.WebviewView {
        const mockEvent = () => {
            return { dispose: () => {/**/}};
        };
        return {
            onDidChangeVisibility: mockEvent,
            onDidDispose: mockEvent,
            viewType: "",
            visible: true,
            show: () => { /**/ },
            webview: {
                asWebviewUri: uri => uri,
                cspSource: "",
                html: "",
                onDidReceiveMessage: mockEvent,
                options: {},
                postMessage: () => Promise.resolve(true),
            }
        };
    }
}

suite("Test settings view", () => {
    let workbenchModel: ListInputModelBase<Workbench>;
    let projectModel: ListInputModelBase<Project>;
    let configModel: ListInputModelBase<Config>;
    let loading: Subject<boolean>;

    let settingsView: SettingsWebview;
    let mockView: vscode.WebviewView;
    let document: Document;

    setup(async() => {
        workbenchModel = new WorkbenchListModel();
        projectModel = new ProjectListModel();
        configModel = new ConfigurationListModel();
        loading = new BehaviorSubject<boolean>(false);

        const extensionUri = vscode.Uri.file("../../");
        settingsView = new SettingsWebview(
            extensionUri,
            workbenchModel,
            projectModel,
            configModel,
            new AddWorkbenchCommand(ToolManager.createIarToolManager()),
            loading,
        );
        mockView = Utils.createMockView();
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        await settingsView.resolveWebviewView(mockView, undefined, undefined);
        updateDocument();
    });

    const updateDocument = function() {
        document = new JSDOM(mockView.webview.html).window.document;
    };

    test("Disables dropdowns on empty models", () => {
        const dropdownIds = [DropdownIds.Workbench, DropdownIds.Project, DropdownIds.Configuration];
        dropdownIds.forEach(id => {
            const dropdown = document.getElementById(id);
            Assert(dropdown);
            Assert.strictEqual(dropdown.getAttribute("disabled"), "", `Dropdown '${id}' should be disabled`);
        });
    });

    test("Shows error on no workbenches", () => {
        const workbenchError = document.getElementById("workbench-error");
        Assert(workbenchError);
        Assert.strictEqual(workbenchError.getAttribute("hidden"), null, "Error message should be visible");
        Assert(workbenchError.textContent?.includes("No IAR toolchain installations found."));
    });

    test("Populates dropdowns", () => {
        workbenchModel.set(
            { name: "Embedded Workbench 9.0", path: "/path/Embedded Workbench 9.0", idePath: "", builderPath: "", version: { major: 0, minor: 0, patch: 0 }, targetIds: ["arm"], type: WorkbenchType.IDE },
            { name: "MyWorkbench", path: "C:\\path\\MyWorkbench", idePath: "", builderPath: "", version: { major: 0, minor: 0, patch: 0 }, targetIds: ["riscv"], type: WorkbenchType.BX }
        );
        workbenchModel.select(2);
        projectModel.set( new Project("/some/directory/LedFlasher.ewp"), new Project("C:\\test\\A project.ewp") );
        projectModel.select(0);
        configModel.set( { name: "Debug", toolchainId: "ARM" }, { name: "Release", toolchainId: "ARM"} );
        configModel.select(1);
        updateDocument();

        const assertDropdownMatchesModel = function<T>(dropdownId: string, model: ListInputModel<T>)  {
            const dropdown = document.getElementById(dropdownId);
            Assert(dropdown);
            Assert.strictEqual(dropdown.getAttribute("disabled"), null, `Dropdown '${dropdownId}' should be enabled`);
            const options = dropdown.children;
            Assert.strictEqual(options.length, model.amount);
            for (let i = 0; i < options.length; i++) {
                Assert.strictEqual(options.item(i)?.tagName, "VSCODE-OPTION", `Incorrect option ${i}`);
                Assert.strictEqual(options.item(i)?.textContent?.trim(), model.label(i), `Incorrect option ${i}`);
                Assert.strictEqual(options.item(i)?.getAttribute("selected"), model.selectedIndex === i ? "" : null, `Incorrect option ${i}`);
            }
        };
        assertDropdownMatchesModel(DropdownIds.Project, projectModel);
        assertDropdownMatchesModel(DropdownIds.Configuration, configModel);

        // test workbench dropdown separately, since it has an additional option
        const dropdown = document.getElementById(DropdownIds.Workbench);
        Assert(dropdown);
        Assert.strictEqual(dropdown.getAttribute("disabled"), null, "Workbench dropdown should be enabled");
        const options = dropdown.children;
        for (let i = 0; i < workbenchModel.amount; i++) {
            Assert.strictEqual(options.item(i)?.tagName, "VSCODE-OPTION", `Incorrect option ${i}`);
            Assert.strictEqual(options.item(i)?.textContent?.trim(), workbenchModel.label(i), `Incorrect option ${i}`);
            Assert.strictEqual(options.item(i)?.getAttribute("selected"), workbenchModel.selectedIndex === i ? "" : null, `Incorrect option ${i}`);
        }
        Assert.strictEqual(options.item(workbenchModel.amount)?.tagName, "VSCODE-DIVIDER");
        Assert.strictEqual(options.item(workbenchModel.amount + 1)?.tagName, "VSCODE-OPTION");
        Assert.strictEqual(options.item(workbenchModel.amount + 1)?.textContent?.trim(), "Add Toolchain...");
    });

    test("Reacts to loading projects", () => {
        configModel.set( { name: "Debug", toolchainId: "ARM" } );
        updateDocument();
        {
            const configs = document.getElementById(DropdownIds.Configuration);
            Assert(configs);
            Assert.strictEqual(configs.getAttribute("disabled"), null, "Dropdown should be enabled");

            const spinner = document.getElementsByTagName("VSCODE-PROGRESS-RING").item(0);
            Assert(spinner);
            Assert.strictEqual(spinner.getAttribute("hidden"), "", "Spinner should be hidden");
        }
        loading.next(true);
        updateDocument();
        {
            const configs = document.getElementById(DropdownIds.Configuration);
            Assert(configs);
            Assert.strictEqual(configs.getAttribute("disabled"), "", "Dropdown should be disabled");

            const spinner = document.getElementsByTagName("VSCODE-PROGRESS-RING").item(0);
            Assert(spinner);
            Assert.strictEqual(spinner.getAttribute("hidden"), null, "Spinner should be visible");
        }
    });

    test("Escapes HTML tags", () => {
        // HTML tags must be escaped to prevent injections
        configModel.set( { name: "<script>alert('Hello')</script><b>Debug</b>", toolchainId: "ARM" } );
        updateDocument();

        const configs = document.getElementById(DropdownIds.Configuration);
        Assert(configs);
        const options = configs.children;
        Assert.strictEqual(options.item(0)?.textContent?.trim(), "<script>alert('Hello')</script><b>Debug</b>");
    });
});
