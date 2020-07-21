import * as path from "path";
import { runTests } from "vscode-test";

async function main() {
    try {
        const extensionDevelopmentPath = path.resolve(__dirname, '../');

        console.log("Running unit tests...");
        const unitTestsPath = path.resolve(__dirname, './unitTests/index');
        await runTests({ extensionDevelopmentPath, extensionTestsPath: unitTestsPath });

        console.log("Running integration tests...");
        const integrationTestsPath = path.resolve(__dirname, './integrationTests/index');
        await runTests({ extensionDevelopmentPath, extensionTestsPath: integrationTestsPath });
    } catch (err) {
        console.error(err);
        console.error('Failed to run tests');
        process.exit(1);
    }
}

main();