
import {runTestsIn} from '../utils/testutils/testRunner'
import * as path from 'path'
import * as fs from 'fs'

async function main() {
    await runTestsIn(path.resolve(__dirname),'../../', './unitTests/index');
    await runTestsIn(path.resolve(__dirname),'../../','./integrationTests/index');
    fs.mkdirSync('../../test-sandbox/UiTestProjects', {recursive: true});
    await runTestsIn(path.resolve(__dirname),'../../','./vscodeTests/index', '../../test-sandbox/UiTestProjects' );
    await runTestsIn(path.resolve(__dirname),'../../','./miscTests/index');
}

main();
