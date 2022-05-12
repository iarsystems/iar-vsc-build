/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import * as Path from "path";

/**
 * Global parameters for a test run.
 */
export interface TestConfiguration {
    // The target id, e.g. 'arm'
    target: string;
    // Whether to test thrift functionality. Only enable this if the workbench supports it.
    testThriftSupport: boolean;
    // Path to a directory with the test project to use for the 'vscodeTests' suite
    vscodeTestProjectsDir: string;
    // If true, checks that C-STAT warnings exactly match the expected values. Otherwise, tests only check that
    // *some* warnings are produced by C-STAT. The format of C-STAT warnings change significantly between versions,
    // so it is not practical to strictly check all versions of it.
    strictCstatCheck: boolean;
    // The cstat output directory for the 'Debug' configuration of the 'C-STATProject' test project
    cstatOutputDir: string;
    // The quoting style to expect for header files in C-STAT warnings. This differs between C-STAT versions.
    cstatHeaderQuoting: [string, string];
    // The C-SPY command line to expect for the 'Debug' configuration of the 'BasicDebugging' test project.
    // This only needs to be specified for targets that support debugging.
    cspyCommandLine?: (workbenchPath: string, projectPath: string) => string[];
    // Path to a directory with the test project to use for the 'integrationTests' suite
    integrationTestProjectsDir: string;
    // The standard include paths (e.g. for the standard library) that should be there for every project
    defaultIncludePaths: RegExp[];
    // An architecture-specific preprocessor macro to look for
    architectureDefine: string;
}

export namespace TestConfiguration {
    let parameters: TestConfiguration | undefined;
    const ENV_KEY = "TEST_PARAMETERS";

    /**
     * Sets the test parameters to use for the current test run.
     * This should only be called from the same process as the tests will run in.
     * When running tests from the command line, use {@link asEnvVars} instead.
     */
    export function setParameters(params: TestConfiguration) {
        parameters = params;
    }

    /**
     * Returns the given parameters as a set of environment variables. When running tests from the command line,
     * this can be used to pass parameters to the tests before starting the VS Code test process.
     * Simply pass the returned variables as environment variables to the test process.
     */
    export function asEnvVars(params: TestConfiguration): Record<string, string> {
        const result: Record<string, string> = {};
        result[ENV_KEY] = JSON.stringify(params);
        return result;
    }

    /**
     * Returns the parameters to use for the current test run,
     * if any have been set using the methods above.
     * Defaults to {@link ARM_CONFIG}.
     */
    export function getConfiguration(): TestConfiguration {
        if (parameters) {
            return parameters;
        }
        const envParams = process.env[ENV_KEY];
        if (envParams) {
            return JSON.parse(envParams);
        }
        return ARM_CONFIG;
    }

    /// Standard test configurations below
    export const ARM_CONFIG: TestConfiguration = {
        target: "arm",
        testThriftSupport: true,
        vscodeTestProjectsDir: Path.join(__dirname, "../../tests/vscodeTests/TestProjects/arm"),
        strictCstatCheck: true,
        cstatOutputDir: "C-STAT Output",
        cstatHeaderQuoting: ["<", ">"],
        cspyCommandLine: (wb, proj) => [
            "/file",
            Path.join(Path.dirname(proj), "Debug/Exe/BasicDebugging.out"),
            "--crun=disabled",
            "--endian=little",
            "--cpu=Cortex-M3",
            "/runto",
            "main",
            "--fpu=None",
            "--semihosting",
            "--multicore_nr_of_cores=1",
            "/driver",
            Path.join(wb, "arm\\bin\\armSIM2.dll"),
            "/proc",
            Path.join(wb, "arm\\bin\\armPROC.dll"),
            "/plugin",
            Path.join(wb, "arm\\bin\\armlibsupport.dll"),
            "/kernel",
            "kernel.dll",
            "/ilink"
        ],
        integrationTestProjectsDir: Path.resolve(__dirname, "../../tests/integrationTests/TestProjects/arm"),
        defaultIncludePaths: [new RegExp("arm[/\\\\]inc[/\\\\]"), new RegExp("arm[/\\\\]inc[/\\\\]c[/\\\\]aarch32")],
        architectureDefine: "__ARM_ARCH",
    };
    export const RISCV_CONFIG: TestConfiguration = {
        target: "riscv",
        testThriftSupport: true,
        vscodeTestProjectsDir: Path.join(__dirname, "../../tests/vscodeTests/TestProjects/riscv"),
        strictCstatCheck: true,
        cstatOutputDir: "C-STAT",
        cstatHeaderQuoting: ["`", "'"],
        cspyCommandLine: undefined,
        integrationTestProjectsDir: Path.resolve(__dirname, "../../tests/integrationTests/TestProjects/riscv"),
        defaultIncludePaths: [new RegExp("riscv[/\\\\]inc[/\\\\]"), new RegExp("riscv[/\\\\]inc[/\\\\]c")],
        architectureDefine: "__riscv",
    };
    export const RH850_CONFIG: TestConfiguration = {
        target: "rh850",
        testThriftSupport: true,
        vscodeTestProjectsDir: Path.join(__dirname, "../../tests/vscodeTests/TestProjects/rh850"),
        strictCstatCheck: false,
        cstatOutputDir: "Obj",
        cstatHeaderQuoting: ["`", "'"],
        cspyCommandLine: (wb, proj) => [
            "/file",
            Path.join(Path.dirname(proj), "Debug/Exe/templproj.out"),
            "--core",
            "g3m",
            "/runto",
            "main",
            "/proc",
            "rh850proc.dll",
            "/plugin",
            Path.join(wb, "rh850\\bin\\rh850libsupport.dll"),
            "/kernel",
            "kernel.dll",
            "-p",
            Path.join(wb, "rh850\\config\\debugger\\iorh850_g3m.ddf"),
            "--double=64",
            "-d",
            "sim",
            "/driver",
            "rh850sim.dll",
            "--multicore_nr_of_cores=1",
        ],
        integrationTestProjectsDir: Path.resolve(__dirname, "../../tests/integrationTests/TestProjects/rh850"),
        defaultIncludePaths: [new RegExp("rh850[/\\\\]inc[/\\\\]"), new RegExp("rh850[/\\\\]inc[/\\\\]c")],
        architectureDefine: "__ICCRH850__",
    };
}