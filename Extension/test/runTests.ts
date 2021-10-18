
import {runTestsIn} from '../utils/testutils/testRunner'
import * as path from 'path'

async function main() {   
    await runTestsIn(path.resolve(__dirname),'../../', './unitTests/index');
    await runTestsIn(path.resolve(__dirname),'../../','./integrationTests/index');
    await runTestsIn(path.resolve(__dirname),'../../','./vscodeTests/index', '../../test/vscodeTests/TestProjects' );
    await runTestsIn(path.resolve(__dirname),'../../','./miscTests/index');
}

main();
