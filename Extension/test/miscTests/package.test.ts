/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */



import * as path from "path";
import * as Assert from "assert";

// Here, we can put sanity checks on the package.json metadata
suite("Test package.json", () => {
    test("All commands are activation events", () => {
        // When a command is run, we need to tell vs code to activate our extension so that we can handle it
        // If the extension is not activated, the user will receive a 'command not found' error
        // Technically, there are some commands that will only ever be called when the extension is already activated,
        // but it's probably safer to add them all anyway

        const packageJsonPath = path.join(__dirname, "../../../package.json");
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const packageJson = require(packageJsonPath);

        const activationEvents: string[] = packageJson["activationEvents"];

        const commands = packageJson["contributes"]["commands"];
        const commandNames: string[] = commands.map((command: any) => command["command"]);

        commandNames.forEach(commandName => {
            Assert(activationEvents.some(event => event === `onCommand:${commandName}`),
                `Command '${commandName} is not in the activation events'`);
        });
    });
});
