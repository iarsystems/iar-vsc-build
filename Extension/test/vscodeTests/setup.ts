import { TestSandbox } from "../../utils/testutils/testSandbox";
import * as Path from "path" ;

export namespace VscodeTestsSetup {
    export let sandbox: TestSandbox | undefined;

    /**
     * Initiates the sandbox for this suite, copying the tests project(s) there.
     * This is called by runTests.ts when running from cli, or by the test suite itself when
     * running from vs code.
     * @returns The path to where the project(s) are copied
     */
    export function setup() {
        sandbox ??= new TestSandbox(Path.join(__dirname, "../../../"));
        return sandbox.copyToSandbox(Path.join(__dirname, "../../../test/vscodeTests/TestProjects"), "UiTestProjects");
    }
}