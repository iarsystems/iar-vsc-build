/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { OsUtils } from "iar-vsc-common/osUtils";
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
    cspyCommandLine?: (workbenchPath: string, projectPath: string) => Array<string | { path: string }>;
    // Path to a directory with the test project to use for the 'integrationTests' suite
    integrationTestProjectsDir: string;
    // The standard include paths (e.g. for the standard library) that should be there for every project
    defaultIncludePaths: RegExp[];
    // An architecture-specific preprocessor macro to look for
    architectureDefine: string;
}

export namespace TestConfiguration {
    export const ENV_KEY = "TEST_CONFIGURATION_NAME";
    let parameters: TestConfiguration | undefined;

    /**
     * Sets the test parameters to use for the current test run.
     * This should only be called from the same process as the tests will run in.
     * When running tests from the command line, use {@link setTestConfigurationByName} instead.
     */
    export function setParameters(params: TestConfiguration) {
        parameters = params;
    }

    /**
     * Returns the parameters to use for the current test run.
     * Uses the first test configuration found using these methods:
     * * A configuration set using {@link setParameters}.
     * * A named configuration specified in the {@link ENV_KEY} environment variable.
     *      See {@link TEST_CONFIGURATIONS} for the available named configuration.
     * * A default Arm configuration.
     */
    export function getConfiguration(): TestConfiguration {
        if (parameters) {
            return parameters;
        }
        const envConfigName = process.env[ENV_KEY];
        if (envConfigName && TEST_CONFIGURATIONS[envConfigName]) {
            return TEST_CONFIGURATIONS[envConfigName]!;
        }
        return TEST_CONFIGURATIONS["arm"]!;
    }

    /// Standard test configurations below
    export const TEST_CONFIGURATIONS: { [id: string]: TestConfiguration } = {
        arm: {
            target: "arm",
            testThriftSupport: true,
            vscodeTestProjectsDir: Path.join(__dirname, "../../tests/vscodeTests/TestProjects/arm"),
            strictCstatCheck: true,
            cstatOutputDir: "C-STAT Output",
            cstatHeaderQuoting: ["`", "'"],
            cspyCommandLine: (wb, proj) => [
                "/file",
                { path: Path.join(Path.dirname(proj), "Debug/Exe/BasicDebugging.out") },
                "--crun=disabled",
                "--endian=little",
                "--cpu=Cortex-M3",
                "/runto",
                "main",
                "--fpu=None",
                "--semihosting",
                "--multicore_nr_of_cores=1",
                "/driver",
                { path: Path.join(wb, OsUtils.detectOsType() === OsUtils.OsType.Windows ? "arm\\bin\\armSIM2.dll" : "arm/bin/libarmSIM2.so") },
                "/proc",
                { path: Path.join(wb, OsUtils.detectOsType() === OsUtils.OsType.Windows ? "arm\\bin\\armPROC.dll" : "arm/bin/libarmPROC.so") },
                "/plugin",
                { path: Path.join(wb, OsUtils.detectOsType() === OsUtils.OsType.Windows ? "arm\\bin\\armLibSupportUniversal.dll" : "arm/bin/libarmLibsupportUniversal.so") },
                "/kernel",
                { path: OsUtils.detectOsType() === OsUtils.OsType.Windows ? "kernel.dll" : "libkernel.so" },
                "/ilink"
            ],
            integrationTestProjectsDir: Path.resolve(__dirname, "../../tests/integrationTests/TestProjects/arm"),
            defaultIncludePaths: [new RegExp("arm[/\\\\]inc[/\\\\]"), new RegExp("arm[/\\\\]inc[/\\\\]c[/\\\\]aarch32")],
            architectureDefine: "__ARM_ARCH",
        },
        riscv: {
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
        },
        rh850: {
            target: "rh850",
            testThriftSupport: true,
            vscodeTestProjectsDir: Path.join(__dirname, "../../tests/vscodeTests/TestProjects/rh850"),
            strictCstatCheck: false,
            cstatOutputDir: "C-STAT",
            cstatHeaderQuoting: ["`", "'"],
            cspyCommandLine: (wb, proj) => [
                "/file",
                { path: Path.join(Path.dirname(proj), "Debug/Exe/templproj.out") },
                "--core",
                "g3m",
                "/runto",
                "main",
                "/proc",
                "rh850proc.dll",
                "/plugin",
                { path: Path.join(wb, "rh850\\bin\\rh850libsupport.dll") },
                "/kernel",
                "kernel.dll",
                "-p",
                { path: Path.join(wb, "rh850\\config\\debugger\\iorh850_g3m.ddf") },
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
        },
        rl78: {
            target: "rl78",
            testThriftSupport: false,
            vscodeTestProjectsDir: Path.join(__dirname, "../../tests/vscodeTests/TestProjects/rl78"),
            strictCstatCheck: false,
            cstatOutputDir: "Obj",
            cstatHeaderQuoting: ["`", "'"],
            integrationTestProjectsDir: Path.resolve(__dirname, "../../tests/integrationTests/TestProjects/rl78"),
            defaultIncludePaths: [new RegExp("rl78[/\\\\]inc[/\\\\]"), new RegExp("rl78[/\\\\]inc[/\\\\]c")],
            architectureDefine: "__ICCRL78__",
        },
        rx: {
            target: "rx",
            testThriftSupport: false,
            vscodeTestProjectsDir: Path.join(__dirname, "../../tests/vscodeTests/TestProjects/rx"),
            strictCstatCheck: false,
            cstatOutputDir: "Obj",
            cstatHeaderQuoting: ["`", "'"],
            integrationTestProjectsDir: Path.resolve(__dirname, "../../tests/integrationTests/TestProjects/rx"),
            defaultIncludePaths: [new RegExp("rx[/\\\\]inc[/\\\\]"), new RegExp("rx[/\\\\]inc[/\\\\]c")],
            architectureDefine: "__ICCRX__",
        },
    };
}
