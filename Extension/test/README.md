# Test-suite for the IAR build integration for Vs-Code.
The test suite for the IAR build integration can be executed both from inside visual studio code itself or from the commandline. 

## Adding a new test suite
To add a new test-suite to the current tests, create a new folder in the "test" directory. In the new directory, add your new test file as [name of file].test.ts and copy an index.ts file from one of the other directories into the test directory. To finalize, open the runTests.js file and add an entry to the main method pointing to the index file.

This is enough to include the test in the CLI testing performed.

## Running the test using VS-Code
Open the launch.json and add a new launch entry as:

            "name": "[name of your test]",
            "type": "extensionHost",
            "request": "launch",
            "runtimeExecutable": "${execPath}",
            "args": [
                "--extensionDevelopmentPath=${workspaceFolder}",
                "--extensionTestsPath=${workspaceFolder}/out/[path to the index file in the test folder",
            ],
            "outFiles": [
                "${workspaceFolder}/out/test/**/*.js"
            ]

The test can be launched directly from the "RUN AND DEBUG" drop-down menu. If the test requires to include a folder, add the path to the folder as the last entry in the args section.

## Running the tests using CLI
The tests can easily be executed using the rakefile in the root of the workspace. The "run-tests" task executes the entire test-sequence and prints the results to the active terminal whereas "run-tests-junit" produces a junit file in each test folder in the "out"-folder structure. This can be useful for when running in CI environments.

## Allowed options
The options allowed for the integration tests are set using environment variables. When running the tests using VS-Code, the user should set the variables using the "env" entry. When running from CLI, the options should be supplied using the "--[optionName]" notation which are automatically translated and injected as environment variables to the tests.

junit/--junit                                : Force the tests to generate junit xml as results.
ew-setup-file/--ew-setup-file="path to file" : Path to a file listing the ew installations to test against supplied as 
                                               a java-properties file