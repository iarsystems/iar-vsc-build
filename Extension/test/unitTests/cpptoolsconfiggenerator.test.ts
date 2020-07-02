/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import * as Assert from "assert";
import { StaticConfigGenerator } from "../../src/extension/configprovider/staticconfiggenerator";
import { Config } from "../../src/iar/project/config";
import { Compiler } from "../../src/iar/tools/compiler";

// TODO: rewrite this
suite("CppToolsConfigGenerator", () => {
    test("Verify fixed path", () => {
        let config = createDefaultConfig();
        let compiler = createDefaultCompiler();

        const generatedConfig = StaticConfigGenerator.generateConfiguration("c", config, undefined, compiler);

        verifyConfig(generatedConfig, config, compiler);
    });

    function verifyConfig(cpptoolsConfig: any, _config: Config, _compiler: Compiler): void {
        Assert.equal(cpptoolsConfig["version"], "4");

        let configurations: any[] = cpptoolsConfig["configurations"];
        let iarConfiguration: any | undefined = undefined;

        configurations.some(configuration => {
            if (configuration["name"] === "IAR") {
                iarConfiguration = configuration;
            }

            return iarConfiguration !== undefined;
        });

        Assert.notEqual(iarConfiguration, undefined);

        // let defines = config.cDefines.concat(compiler.cDefines);
        // let includePaths = config.cIncludes.concat(compiler.cIncludePaths);
        // let preincludes = config.preIncludes;

        // Assert.equal(iarConfiguration["defines"].length, defines.length);
        // Assert.equal(iarConfiguration["includePath"].length, includePaths.length);
        // Assert.equal(iarConfiguration["forcedInclude"].length, preincludes.length);

        // const defineEqual = (d1: Define, d2: Define): boolean => {
        //     return ((d1.value === d2.value) && (d1.identifier === d2.identifier));
        // };
        // const includePathEqual = (p1: IncludePath, p2: IncludePath): boolean => {
        //     return ((p1.absolutePath === p2.absolutePath) && (p1.path === p2.path) && (p1.workspacePath === p2.workspacePath));
        // };
        // const preincludePathEqual = (p1: PreIncludePath, p2: PreIncludePath): boolean => {
        //     return ((p1.path === p2.path) && (p1.absolutePath === p2.absolutePath) && (p1.workspaceRelativePath === p2.workspaceRelativePath));
        // };

        // Assert.equal(arraysContainSameElements(defineEqual, defines, iarConfiguration["defines"]), true);
        // Assert.equal(arraysContainSameElements(includePathEqual, includePaths, iarConfiguration["includePath"]), true);
        // Assert.equal(arraysContainSameElements(preincludePathEqual, preincludes, iarConfiguration["forcedInclude"]), true);
    }

    function createDefaultConfig(): Config {
        let name = "Default Config";
        // let defines: Define[] = [
        //     { identifier: "DEBUG", value: undefined },
        //     { identifier: "Simulate", value: "1" }
        // ];
        // let includePaths: IncludePath[] = [
        //     { path: "Modules\\inc", absolutePath: "C:\\workspace\\src\\Modules\\inc", workspacePath: "src\\Modules\\inc" },
        //     { path: "lib\\inc", absolutePath: "C:\\workspace\\src\\lib\\inc", workspacePath: "src\\lib\\inc" },
        // ];

        // let preIncludePaths: PreIncludePath[] = [
        //     { path: "Modules\\inc\\preinc.h", absolutePath: "C:\\workspace\\src\\Modules\\inc\\preinc.h", workspaceRelativePath: "src\\Modules\\inc\\preinc.h" }
        // ];

        return {
            name: name,
            toolchainId: ""
        };
    }

    function createDefaultCompiler(): Compiler {
        let path = "C:\\MyCompiler\\cc.exe";
        // let defines: Define[] = [
        //     { identifier: "COMPILER", value: "MyCompiler" },
        //     { identifier: "STD", value: undefined }
        // ];
        // let includePaths: IncludePath[] = [
        //     { path: "C:\\MyCompiler\\inc", absolutePath: "C:\\MyCompiler\\inc", workspacePath: "..\\MyCompiler\\inc" },
        // ];
        // let keywords: Keyword[] = [
        //     { identifier: "MyKeyword" }
        // ];

        return {
            name: "cc",
            path: path,
        };
    }

    /**
     * This function compares multiple arrays to check if they ALL contain the
     * same elements. This does not mean the order of the elements are the same!
     * 
     * @param fnEqual A function that can check equality of each item
     * @param arrays The arrays to compare
     */
    // function arraysContainSameElements<T>(fnEqual: (item1: T, item2: T) => boolean, ...arrays: T[][]): boolean {
    //     let areEqual = true;

    //     // we use the first array as the master array, all others need to be the same as this one
    //     const masterArray: ReadonlyArray<T> = arrays[0];

    //     // go over all other arrays and check if they are equal
    //     arrays.slice(1).some((array): boolean => {
    //         if (masterArray.length !== array.length) {
    //             areEqual = false;
    //         } else {
    //             // We are going to remove items from the master array, so we need to take a copy to not modify the
    //             // passed array.
    //             let masterCopy = Array.from(masterArray);

    //             // find an item that is not found in the master array
    //             array.some((item): boolean => {
    //                 let itemIndex: number | undefined = undefined;

    //                 masterCopy.some((masterItem, index): boolean => {
    //                     if (!fnEqual(item, masterItem)) {
    //                         itemIndex = index;
    //                     }

    //                     return itemIndex !== undefined;
    //                 });

    //                 // In case the item is found, remove it from the master. This way we fasten the function a bit
    //                 // and we can also handle duplicates.
    //                 if (itemIndex !== undefined) {
    //                     masterCopy.splice(itemIndex, 1);
    //                 }

    //                 // Stop  when an item is not found
    //                 return itemIndex === undefined;
    //             });

    //             // If the master array is not empty, not all items from the array were found in the master
    //             if (masterCopy.length > 0) {
    //                 areEqual = false;
    //             }
    //         }

    //         return areEqual === false;
    //     });

    //     return areEqual;
    // }
});
