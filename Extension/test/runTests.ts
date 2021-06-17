
import * as path from 'path';
import { runTests } from "vscode-test";
import { TestOptions } from "vscode-test/out/runTest";

/**
 * Construct a key:string based on the supplied options from the commandline.
 * @returns 
 */
 export function getEnvs() : any{
    let envs:any = {};
    for(let opt of process.argv.slice(2)){
        if(opt.startsWith('--')){
            let options = opt.substr(2).split('=');
            if(options.length > 1){
                envs[options[0]] = options[1];
            }else{
                envs[options[0]] = "true";
            }
        }
    }
    return envs;
}

/**
 * Run a set of tests using the vscode-runtests interface.
 * @param testPath The path to the index file to run.
 * @param additionalDirectories A directory to include in the tests.
 */
 export async function runTestsIn(testPath:string, additionalDirectories: string | undefined = undefined){
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    try {
        console.log("Running tests in " + testPath);
        const unitTestsPath = path.resolve(__dirname, testPath);

        let options:TestOptions = {extensionDevelopmentPath, extensionTestsPath: unitTestsPath};

        if(additionalDirectories){
            const additionals = path.resolve(__dirname, additionalDirectories);
            options.launchArgs = [additionals];
        }

        options.extensionTestsEnv = getEnvs()

        await runTests(options);
    } catch (err) {
        console.error(err);
    }
}

async function main() {
    await runTestsIn('./unitTests/index');
    await runTestsIn('./integrationTests/index');
    await runTestsIn('./vscodeTests/index', '../../test/vscodeTests/TestProjects' );
}

main();
