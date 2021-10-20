import * as path from "path";

export namespace IntegrationTestsCommon {
    // Path to a test project we can load and read settings from.
    export const TEST_PROJECT_FILE = path.resolve(__dirname, "../../../test/ewpFiles/test_project.ewp");
    // Path to the only source file of the test project.
    export const TEST_SOURCE_FILE = path.resolve(__dirname, "../../../test/ewpFiles/main.c");
}