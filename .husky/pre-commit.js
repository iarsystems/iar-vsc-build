/// -----------------------------
// This hook forces the source for the "iar-vsc-common" dependency to point to the public repository on IAR System's github.
// During development it's practical to use other sources for this dependency (i.e. a local clone); this hook should
// prevent accidental commits of such changes.
/// -----------------------------

const { spawnSync } = require("child_process");
const { readFileSync } = require("fs");
const { exit } = require("process");
var proc = require('child_process');

function runAndGetStdout(command, callback){
    proc.exec(command, function(error, stdout, stderr) {
        callback(stdout);
    });
};

runAndGetStdout("git diff --cached --name-only --diff-filter=ACMR", function(changedFiles) {
    const regex = "git@github\\.com:IARSystems/iar-vsc-common\\.git#[\\da-fA-F]{8}"
    if (changedFiles.includes("package.json")) {
        runAndGetStdout("git --no-pager show :package.json", function(package) {
            const source = JSON.parse(package)["dependencies"]?.["iar-vsc-common"];
            if (!new RegExp(regex).test(source)) {
                console.log(`package.json: The source for the dependency 'iar-vsc-common' is not allowed: '${source}'.`);
                console.log(`    It must match '${regex}'.`);
                console.log("    Using other values will break the build.");
                exit(1);
            }
        });
    }

    if (changedFiles.includes("package-lock.json")) {
        runAndGetStdout("git --no-pager show :package-lock.json", function(package_lock) {
            const source = JSON.parse(package_lock)["packages"]?.[""]?.["dependencies"]?.["iar-vsc-common"];
            if (!new RegExp(regex).test(source)) {
                console.log(`package-lock.json: The source for the dependency 'iar-vsc-common' is not allowed: '${source}'.`);
                console.log(`    It must match '${regex}'.`);
                console.log("    Using other values will break the build.");
                exit(1);
            }
        });
    }
});