import * as Assert from "assert";
import * as Vscode from "vscode";
import * as path from "path";
import { VscodeTestsUtils } from "./utils";
import { OsUtils } from "../../utils/osUtils";
import { readdir, unlink } from "fs/promises";
import { VscodeTestsSetup } from "./setup";

namespace Utils {
    export function assertPathEquals(actual: string, expected: string) {
        if (OsUtils.detectOsType() === OsUtils.OsType.Windows) {
            Assert.strictEqual(actual.toLowerCase(), expected.toLowerCase());
        } else {
            Assert.strictEqual(actual, expected);
        }
    }

    export function assertDiagnosticEquals(actual: Vscode.Diagnostic, expected: Vscode.Diagnostic) {
        Assert.strictEqual(actual.message, expected.message);
        Assert.strictEqual(actual.source, expected.source);
        Assert.strictEqual(actual.severity, expected.severity);
        Assert.deepStrictEqual(actual.range, expected.range);
        Assert.deepStrictEqual(actual.relatedInformation, expected.relatedInformation);
    }
}

suite("Test C-STAT", ()=>{
    const ANALYSIS_TASK = "Run C-STAT Analysis";
    const ANALYSIS_TASK_CONFIGURED = "iar-cstat: Run C-STAT Analysis (configured)";
    const CLEAR_TASK = "Clear C-STAT Diagnostics";
    const CLEAR_TASK_CONFIGURED = "iar-cstat: Clear C-STAT Diagnostics (configured)";

    const TARGET_PROJECT = "C-STATProject";

    let sandboxPath: string;
    let originalFilterLevel: string | undefined;

    suiteSetup(async() => {
        sandboxPath = VscodeTestsSetup.setup();
        originalFilterLevel = Vscode.workspace.getConfiguration("iarvsc").get("c-StatFilterLevel");
        // Remove all backup files, since too many backup files will cause iarbuild to fail
        const nodes = await readdir(path.join(sandboxPath, TARGET_PROJECT));
        return Promise.all(
            nodes.filter(node => node.startsWith("Backup")).map(node => unlink(path.join(sandboxPath, TARGET_PROJECT, node)))
        );
    });

    suiteTeardown(() => {
        Vscode.workspace.getConfiguration("iarvsc").update("c-StatFilterLevel", originalFilterLevel);
    });

    test("Tasks exist", async() => {
        const expectedTasks = [ANALYSIS_TASK, CLEAR_TASK, ANALYSIS_TASK_CONFIGURED, CLEAR_TASK_CONFIGURED];

        const tasks = await Vscode.tasks.fetchTasks({ type: "iar-cstat" });
        const taskNames = tasks.map(task => task.name);
        Assert.deepStrictEqual(taskNames.sort(), expectedTasks.sort());
    });

    const makeRange = (line: number, col: number) => {
        const pos = new Vscode.Position(Math.max(line - 1, 0), Math.max(col - 1, 0));
        return new Vscode.Range(pos, pos);
    };

    const expectedDiagnostics: Vscode.Diagnostic[] = [
        { message: "An integer constant is used with a pointer in the expression `0'", source: "MISRAC2012-Rule-11.9 [Medium]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(9, 12) },
        { message: "Variable `arr' is only used once", source: "MISRAC++2008-0-1-4_a [Low]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(23, 10) },
        { message: "Type of if condition is not Boolean", source: "MISRAC++2008-5-0-13_c,MISRAC2012-Rule-14.4_c [Low]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(22, 5) },
        { message: "Variable `local' is not modified and should be declared `const'", source: "MISRAC++2008-7-1-1 [Low]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(15, 9) },
        { message: "The return value of this call to `printf()' is discarded", source: "MISRAC++2008-0-1-7,MISRAC2012-Rule-17.7 [Low]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(19, 5) },
        { message: "Conditional expression `a' is always false", source: "MISRAC++2008-0-1-2_b,MISRAC2012-Rule-14.3_b [Medium]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(22, 5) },
        { message: "Implicit conversion of `a' from essential type signed 32-bit int to different or narrower essential type character", source: "MISRAC2012-Rule-10.3 [Medium]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(24, 14) },
        { message: "Function call `bad_fun()' is immediately dereferenced, without checking for NULL", source: "PTR-null-fun-pos [High]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(22, 18) },
        { message: "Array `arr' 1st subscript 4 is out of bounds [0,3]", source: "ARR-inv-index,MISRAC++2008-5-0-16_c,MISRAC2012-Rule-18.1_a,CERT-ARR30-C_a [High]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(24, 8) },
        { message: "Missing return statement on some paths", source: "MISRAC++2008-8-4-3,MISRAC2004-16.8,MISRAC2012-Rule-17.4 [Medium]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(13, 5) },
        { message: "Calling standard library function `printf' without detecting and handling errors or casting explicitly to `void'", source: "CERT-ERR33-C_c [High]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(19, 5) },
        { message: "`addOne' does not have a valid prototype, calls bypass all type checking", source: "FUNC-unprototyped-used [Low]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(17, 11) },
        { message: "A // style comment", source: "MISRAC2004-2.2 [Low]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(4, 1) },
        { message: "Definition of externally-linked `global' has no compatible declaration", source: "MISRAC2012-Rule-8.4 [Low]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(6, 5) },
        { message: "Definition of externally-linked `bad_fun()' has no compatible declaration", source: "MISRAC2012-Rule-8.4 [Low]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(8, 6) },
        { message: "`addOne' does not have a valid prototype", source: "MISRAC2004-8.1,MISRAC2012-Rule-17.3,CERT-DCL31-C [Medium]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(17, 11) },
        { message: "Source file is not compiled in strict C89 mode without extensions", source: "MISRAC2004-1.1 [Medium]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(0, 0) },
        { message: "`main' does not have a valid prototype", source: "MISRAC2004-16.5,MISRAC2012-Rule-8.2_a [Medium]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(13, 5) },
        { message: "`bad_fun' does not have a valid prototype", source: "MISRAC2004-16.5,MISRAC2012-Rule-8.2_a [Medium]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(8, 6) },
        { message: "Use of <stdio.h> is not compliant", source: "MISRAC++2008-27-0-1,MISRAC2004-20.9,MISRAC2012-Rule-21.6 [Low]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(1, 19) },
        { message: "Function `addOne' declared at block scope", source: "MISRAC2004-8.6 [Low]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(17, 11) }
    ];

    // Expected to time out until VSC-75 is fixed (a bug in the VS Code platform)
    test("Run C-STAT on all listed EWs", async()=>{
        Vscode.workspace.getConfiguration("iarvsc").update("c-StatFilterLevel", "Low");
        const listedEws = VscodeTestsUtils.getEntries(VscodeTestsUtils.EW);
        if (Array.isArray(listedEws)) {
            console.log(listedEws);
            for (const ew of listedEws) {
                Assert.strictEqual(typeof ew.label, "string");
                VscodeTestsUtils.activateWorkbench(ew.label as string);

                // Make sure diagnostics are empty before we start
                let diagnostics = Vscode.languages.getDiagnostics().flatMap(pair => pair[1]);
                Assert.deepStrictEqual(diagnostics, [], "There were diagnostics before starting C-STAT task, check the test setup, or a previous test failed");

                await VscodeTestsUtils.runTaskForProject(ANALYSIS_TASK, TARGET_PROJECT, "Debug");
                const fileDiagnostics = Vscode.languages.getDiagnostics().filter(diag => diag[1].length > 0);
                Assert.strictEqual(fileDiagnostics.length, 1, "Expected diagnostics in main file (only)");
                const expectedPath = path.join(sandboxPath, TARGET_PROJECT, "main.c");
                Utils.assertPathEquals(fileDiagnostics[0]![0].fsPath, expectedPath);

                diagnostics = fileDiagnostics.flatMap(pair => pair[1]);
                Assert.strictEqual(diagnostics.length, expectedDiagnostics.length, "Actual and expected diagnostics are not the same length");
                diagnostics.sort((a, b) => a.message < b.message ? -1 : 1);
                expectedDiagnostics.sort((a, b) => a.message < b.message ? -1 : 1);
                diagnostics.forEach((diag, i) => {
                    Utils.assertDiagnosticEquals(diag, expectedDiagnostics[i]!);
                });

                await VscodeTestsUtils.runTaskForProject(CLEAR_TASK, TARGET_PROJECT, "Debug");
                diagnostics = Vscode.languages.getDiagnostics().flatMap(pair => pair[1]);
                Assert.deepStrictEqual(diagnostics, [], "Not all C-STAT warnings were cleared");
            }
        }
    });

    test("Run C-STAT with configured tasks", async()=>{
        Vscode.workspace.getConfiguration("iarvsc").update("c-StatFilterLevel", "Low");
        const targetProject = "C-STATProject";
        const listedEws = VscodeTestsUtils.getEntries(VscodeTestsUtils.EW);
        if (Array.isArray(listedEws)) {
            for (const ew of listedEws) {
                Assert.strictEqual(typeof ew.label, "string");
                VscodeTestsUtils.activateWorkbench(ew.label as string);

                // Make sure diagnostics are empty before we start
                let diagnostics = Vscode.languages.getDiagnostics().flatMap(pair => pair[1]);
                Assert.deepStrictEqual(diagnostics, [], "There were diagnostics before starting C-STAT task, check the test setup, or a previous test failed");

                await VscodeTestsUtils.runTaskForProject(ANALYSIS_TASK_CONFIGURED, targetProject, "Debug");
                const fileDiagnostics = Vscode.languages.getDiagnostics().filter(diag => diag[1].length > 0);
                Assert.strictEqual(fileDiagnostics.length, 1, "Expected diagnostics in main file (only)");
                const expectedPath = path.join(sandboxPath, targetProject, "main.c");
                Utils.assertPathEquals(fileDiagnostics[0]![0].fsPath, expectedPath);

                diagnostics = fileDiagnostics.flatMap(pair => pair[1]);
                Assert.strictEqual(diagnostics.length, expectedDiagnostics.length, "Actual and expected diagnostics are not the same length");
                diagnostics.sort((a, b) => a.message < b.message ? -1 : 1);
                expectedDiagnostics.sort((a, b) => a.message < b.message ? -1 : 1);
                diagnostics.forEach((diag, i) => {
                    Utils.assertDiagnosticEquals(diag, expectedDiagnostics[i]!);
                });

                await VscodeTestsUtils.runTaskForProject(CLEAR_TASK_CONFIGURED, targetProject, "Debug");
                diagnostics = Vscode.languages.getDiagnostics().flatMap(pair => pair[1]);
                Assert.deepStrictEqual(diagnostics, [], "Not all C-STAT warnings were cleared");
            }
        }
    });
    const expectedDiagnosticsHigh: Vscode.Diagnostic[] = [
        { message: "Calling standard library function `printf' without detecting and handling errors or casting explicitly to `void'", source: "CERT-ERR33-C_c [High]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(19, 5) },
        { message: "Array `arr' 1st subscript 4 is out of bounds [0,3]", source: "ARR-inv-index,MISRAC++2008-5-0-16_c,MISRAC2012-Rule-18.1_a,CERT-ARR30-C_a [High]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(24, 8) },
        { message: "Function call `bad_fun()' is immediately dereferenced, without checking for NULL", source: "PTR-null-fun-pos [High]", severity: Vscode.DiagnosticSeverity.Warning, range: makeRange(22, 18) },
    ];
    test("Run C-STAT with high filter level", async()=>{
        const targetProject = "C-STATProject";
        Vscode.workspace.getConfiguration("iarvsc").update("c-StatFilterLevel", "High");

        const listedEws = VscodeTestsUtils.getEntries(VscodeTestsUtils.EW);
        if (Array.isArray(listedEws)) {
            for (const ew of listedEws) {
                Assert.strictEqual(typeof ew.label, "string");
                VscodeTestsUtils.activateWorkbench(ew.label as string);

                // Make sure diagnostics are empty before we start
                let diagnostics = Vscode.languages.getDiagnostics().flatMap(pair => pair[1]);
                Assert.deepStrictEqual(diagnostics, [], "There were diagnostics before starting C-STAT task, check the test setup, or a previous test failed");

                // TODO: CHANGE TASK NAME BACK
                await VscodeTestsUtils.runTaskForProject(ANALYSIS_TASK_CONFIGURED, targetProject, "Debug");
                const fileDiagnostics = Vscode.languages.getDiagnostics().filter(diag => diag[1].length > 0);
                Assert.strictEqual(fileDiagnostics.length, 1, "Expected diagnostics in main file (only)");
                const expectedPath = path.join(sandboxPath, targetProject, "main.c");
                Utils.assertPathEquals(fileDiagnostics[0]![0].fsPath, expectedPath);

                diagnostics = fileDiagnostics.flatMap(pair => pair[1]);
                Assert.strictEqual(diagnostics.length, expectedDiagnosticsHigh.length, "Actual and expected diagnostics are not the same length");
                diagnostics.sort((a, b) => a.message < b.message ? -1 : 1);
                expectedDiagnosticsHigh.sort((a, b) => a.message < b.message ? -1 : 1);
                diagnostics.forEach((diag, i) => {
                    Utils.assertDiagnosticEquals(diag, expectedDiagnosticsHigh[i]!);
                });

                await VscodeTestsUtils.runTaskForProject(CLEAR_TASK_CONFIGURED, targetProject, "Debug");
                diagnostics = Vscode.languages.getDiagnostics().flatMap(pair => pair[1]);
                Assert.deepStrictEqual(diagnostics, [], "Not all C-STAT warnings were cleared");
            }
        }
    });
});