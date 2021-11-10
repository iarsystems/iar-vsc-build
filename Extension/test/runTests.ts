
import {runTestsIn} from "../utils/testutils/testRunner";
import * as path from "path";
import { VscodeTestsUtils } from "./vscodeTests/utils";

async function main() {
    await runTestsIn(path.resolve(__dirname), "../../", "./unitTests/index");
    await runTestsIn(path.resolve(__dirname), "../../", "./integrationTests/index");
    // A temp workspace ("sandbox") needs to be set up _before_ we launch vscode,
    // so that the projects are detected correctly
    const workspaceDir = VscodeTestsUtils.setup();
    await runTestsIn(path.resolve(__dirname), "../../", "./vscodeTests/index", workspaceDir);
    await runTestsIn(path.resolve(__dirname), "../../", "./miscTests/index");
}

main();
