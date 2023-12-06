/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { JSDOM } from "jsdom";
import * as vscode from "vscode";
import * as Assert from "assert";
import { AddWorkbenchCommand } from "../../src/extension/command/addworkbench";
import { WorkbenchListModel } from "../../src/extension/model/selectworkbench";
import { DropdownIds, SettingsWebview } from "../../src/extension/ui/settingswebview";
import { Workbench, WorkbenchType } from "iar-vsc-common/workbench";
import { Project } from "../../src/iar/project/project";
import { ListInputModel, MutableListInputModelBase } from "../../src/extension/model/model";
import { IarToolManager } from "../../src/iar/tools/manager";
import { BehaviorSubject, Subject } from "rxjs";
import { EwWorkspace } from "../../src/iar/workspace/ewworkspace";
import { WorkspaceListModel } from "../../src/extension/model/selectworkspace";
import { EwwFile } from "../../src/iar/workspace/ewwfile";
import { AsyncObservable } from "../../src/utils/asyncobservable";

namespace Utils {
    // A fake view we can receive html to, and then inspect it.
    export function createMockView(): vscode.WebviewView {
        const mockEvent = () => {
            return { dispose: () => {/**/ } };
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
    let workbenchModel: MutableListInputModelBase<Workbench>;
    let workspacesModel: MutableListInputModelBase<EwwFile>;
    let workspaceModel: AsyncObservable<EwWorkspace>;
    let loading: Subject<boolean>;

    let settingsView: SettingsWebview;
    let mockView: vscode.WebviewView;
    let document: Document;

    setup(async() => {
        workbenchModel = new WorkbenchListModel();
        workspacesModel = new WorkspaceListModel();
        workspaceModel = new AsyncObservable();
        loading = new BehaviorSubject<boolean>(false);

        const extensionUri = vscode.Uri.file("../../");
        settingsView = new SettingsWebview(
            extensionUri,
            workbenchModel,
            workspacesModel,
            workspaceModel,
            new AddWorkbenchCommand(new IarToolManager()),
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
        const dropdownIds = [DropdownIds.Workbench, DropdownIds.Project, DropdownIds.Project, DropdownIds.Configuration];
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

    test("Populates dropdowns", async() => {
        workbenchModel.set(
            makeMockWorkbench("Embedded Workbench 9.0", "/path/Embedded Workbench 9.0"),
            makeMockWorkbench("MyWorkbench", "C:\\path\\MyWorkbench"),
        );

        const mockProjects: Project[] = [
            makeMockProject("LedFlasher", "/some/directory/LedFlasher.ewp"),
            makeMockProject("A project", "C:\\test\\A project.ewp"),
        ];

        workspacesModel.set(
            new EwwFile("C:\\test\\A workspace.eww"),
            new EwwFile("/some/directory/LedFlasher.eww"),
        );
        workspacesModel.select(0);

        const workspace = new EwWorkspace(new EwwFile("/some/directory/LedFlasher.eww"), mockProjects);
        workspaceModel.setValue(workspace);
        // Yield to let the new value propagate
        await new Promise<void>(res => res());

        workspace.projects.select(0);
        workspace.setActiveConfig(workspace.projects.selected?.configurations[1]);
        updateDocument();

        const assertDropdownMatchesModel = function <T>(dropdownId: string, model: ListInputModel<T>) {
            const dropdown = document.getElementById(dropdownId);
            Assert(dropdown);
            Assert.strictEqual(dropdown.getAttribute("disabled"), null, `Dropdown '${dropdownId}' should be enabled`);
            const options = dropdown.children;
            Assert.strictEqual(options.length, model.items.length);
            for (let i = 0; i < options.length; i++) {
                Assert.strictEqual(options.item(i)?.tagName, "VSCODE-OPTION", `Incorrect option ${i}`);
                Assert.strictEqual(options.item(i)?.textContent?.trim(), model.label(i), `Incorrect option ${i}`);
                Assert.strictEqual(options.item(i)?.getAttribute("selected"), model.selectedIndex === i ? "" : null, `Incorrect option ${i}`);
            }
        };

        assertDropdownMatchesModel(DropdownIds.Workspace, workspacesModel);
        assertDropdownMatchesModel(DropdownIds.Project, workspace.projects);
        assertDropdownMatchesModel(DropdownIds.Configuration, workspace.projectConfigs);

        // test workbench dropdown separately, since it has an additional option
        const dropdown = document.getElementById(DropdownIds.Workbench);
        Assert(dropdown);
        Assert.strictEqual(dropdown.getAttribute("disabled"), null, "Workbench dropdown should be enabled");
        const options = dropdown.children;

        // We didn't select a workbench, there should be a "None selected..." option at the top
        Assert.strictEqual(options.item(0)?.tagName, "VSCODE-OPTION");
        Assert.strictEqual(options.item(0)?.textContent?.trim(), "None selected...");
        Assert.strictEqual(options.item(0)?.getAttribute("selected"), "");
        for (let i = 0; i < workbenchModel.items.length; i++) {
            Assert.strictEqual(options.item(i + 1)?.tagName, "VSCODE-OPTION", `Incorrect option ${i + 1}`);
            Assert.strictEqual(options.item(i + 1)?.textContent?.trim(), workbenchModel.label(i), `Incorrect option ${i + 1}`);
            Assert.strictEqual(options.item(i + 1)?.getAttribute("selected"), null, `Incorrect option ${i + 1}`);
        }
        Assert.strictEqual(options.item(workbenchModel.items.length + 1)?.tagName, "VSCODE-DIVIDER");
        Assert.strictEqual(options.item(workbenchModel.items.length + 2)?.tagName, "VSCODE-OPTION");
        Assert.strictEqual(options.item(workbenchModel.items.length + 2)?.textContent?.trim(), "Add Toolchain...");
    });

    test("Reacts to loading workbenches", () => {
        workbenchModel.set(makeMockWorkbench("MyWorkbench", "C:\\path\\MyWorkbench"));
        updateDocument();
        {
            const wbs = document.getElementById(DropdownIds.Workbench);
            Assert(wbs);
            Assert.strictEqual(wbs.getAttribute("disabled"), null, "Dropdown should be enabled");

            const spinner = document.getElementsByTagName("VSCODE-PROGRESS-RING").item(0);
            Assert(spinner);
            Assert.strictEqual(spinner.getAttribute("hidden"), "", "Spinner should be hidden");
        }
        loading.next(true);
        updateDocument();
        {
            const wbs = document.getElementById(DropdownIds.Workbench);
            Assert(wbs);
            Assert.strictEqual(wbs.getAttribute("disabled"), "", "Dropdown should be disabled");

            const spinner = document.getElementsByTagName("VSCODE-PROGRESS-RING").item(0);
            Assert(spinner);
            Assert.strictEqual(spinner.getAttribute("hidden"), null, "Spinner should be visible");
        }
    });

    test("Reacts to loading workspaces", async() => {
        workspaceModel.setValue(new EwWorkspace(undefined, [makeMockProject("MyProject", "")]));
        // Yield to let the new value propagate
        await new Promise<void>(res => res());
        updateDocument();
        {
            const projects = document.getElementById(DropdownIds.Project);
            Assert(projects);
            Assert.strictEqual(projects.getAttribute("disabled"), null, "Dropdown should be enabled");

            const spinner = document.getElementsByTagName("VSCODE-PROGRESS-RING").item(1);
            Assert(spinner);
            Assert.strictEqual(spinner.getAttribute("hidden"), "", "Spinner should be hidden");
        }
        workspaceModel.setWithPromise(new Promise(() => { /* never resolves */ }));
        updateDocument();
        {
            const projects = document.getElementById(DropdownIds.Project);
            Assert(projects);
            Assert.strictEqual(projects.getAttribute("disabled"), "", "Dropdown should be disabled");

            const spinner = document.getElementsByTagName("VSCODE-PROGRESS-RING").item(1);
            Assert(spinner);
            Assert.strictEqual(spinner.getAttribute("hidden"), null, "Spinner should be visible");
        }
    });

    test("Escapes HTML tags", () => {
        // HTML tags must be escaped to prevent injections
        workbenchModel.set(makeMockWorkbench("<script>alert('Hello')</script><b>Debug</b>", ""));
        workbenchModel.select(0);
        updateDocument();

        const wbs = document.getElementById(DropdownIds.Workbench);
        Assert(wbs);
        const options = wbs.children;
        Assert.strictEqual(options.item(0)?.textContent?.trim(), "<script>alert('Hello')</script><b>Debug</b>");
    });

    function makeMockWorkbench(name: string, path: string): Workbench {
        return { name, path, idePath: "", builderPath: "", version: { major: 0, minor: 0, patch: 0 }, targetIds: ["riscv"], type: WorkbenchType.LEGACY_BX };
    }

    function makeMockProject(name: string, path: string): Project {
        return {
            name,
            path,
            configurations: [
                { name: "Debug", targetId: "arm", isControlFileManaged: false },
                { name: "Release", targetId: "arm", isControlFileManaged: false },
            ],
            findConfiguration: () => undefined,
            reload: () => { /**/ },
            addOnChangeListener: (_) => { /**/ },
            removeOnChangeListener: () => { /**/ },
        };
    }
});
