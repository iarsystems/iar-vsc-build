import * as path from "path";
import { runTests } from "vscode-test";
import { TestOptions } from "vscode-test/out/runTest";

async function runTestsIn(produceJunit:boolean,testPath:string, additionalDirectories: string | undefined = undefined){
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    try {
        console.log("Running tests in " + testPath);
        const unitTestsPath = path.resolve(__dirname, testPath);

        let options:TestOptions = {extensionDevelopmentPath, extensionTestsPath: unitTestsPath};

        if(additionalDirectories){
            const additionals = path.resolve(__dirname, additionalDirectories);
            options.launchArgs = [additionals];
        }

        if(produceJunit){
            options.extensionTestsEnv = {junit:"true"};
        }

        await runTests(options);
    } catch (err) {
        console.error(err);
    }
}

async function main() {
    let produceJunit: boolean = process.argv.includes("--junit");
    await runTestsIn(produceJunit, './unitTests/index');
    await runTestsIn(produceJunit, './integrationTests/index');
    await runTestsIn(produceJunit, './vscodeTests/index', '../../test/vscodeTests/TestProjects' );
}

main();