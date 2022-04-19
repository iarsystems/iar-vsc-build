import * as path from "path";
import { Settings } from "../../src/extension/settings";
import { ToolManager } from "../../src/iar/tools/manager";
import * as fs from "fs";

export namespace IntegrationTestsCommon {
    // Root folder of the extension project
    export const PROJECT_ROOT = path.join(__dirname, "../../../");
    // Path to a directory with a test project we can load and read settings from.
    export const TEST_PROJECTS_DIR = path.resolve(__dirname, "../../../tests/integrationTests/TestProjects");
    // Name of the test project
    export const TEST_PROJECT_NAME = "test_project.ewp";
    // Name of the only file in the test project
    export const TEST_PROJECT_SOURCE_FILE = "main.c";

    export async function findWorkbenchesContainingTarget(target: string) {
        const manager = ToolManager.createIarToolManager();
        await manager.collectWorkbenches(Settings.getIarInstallDirectories(), false);

        return manager.workbenches.filter(wb => {
            return fs.existsSync(path.join(wb.path.toString(), target));
        });
    }
}