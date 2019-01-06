
import { Workbench } from "../../src/iar/tools/workbench";

suite("Test tools creation with filesystem", () => {
    test("Using real filesystem", () => {
        /* For now not really much of testing, just try to fetch all data from
           the local filesystem and print the result. To improve this we have to
           create something like a filesystem simulator using stubbing, but that
           is a lot of work for now. */
        let workbenches = Workbench.collectWorkbenchesFrom("C:\\Program Files (x86)\\Iar Systems\\");

        console.log(workbenches);
    });
});
