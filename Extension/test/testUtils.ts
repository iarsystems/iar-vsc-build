
import * as Mocha from 'mocha';
import * as path from 'path';
import * as fs from 'fs';


export function getTestPromise(testsRoot:string) : Promise<void>{

    let junitFile:string = "/junit-vs-" + path.dirname(testsRoot) + ".xml";

    let options:any = {ui: 'tdd'};
    if(process.env["junit"]){
        console.log("Adding junit file " + junitFile);
        options.reporter = 'mocha-junit-reporter';
        options.reporterOptions = {mochaFile: testsRoot + junitFile}
    }
    const mocha = new Mocha(options);
    mocha.useColors(true);


    return new Promise((c, e) => {
        // run all test files in this directory
        fs.readdir(testsRoot, (err, files) => {
            if (err) { return e(err); }
            files = files.filter(file => file.endsWith(".test.js"));

            // Add files to the test suite
            files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

            try {
                // Run the mocha test
                mocha.run(failures => {
                    if (failures > 0) {
                        e(new Error(`${failures} tests failed.`));
                    } else {
                        c();
                    }
                });
            } catch (err) {
                e(err);
            }
        });
    });
}