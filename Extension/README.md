# iar-vsc README

This plugin make it possible to combine the IAR compiler solutions with Visual Studio Code. The goal is that this plugin supports all compiler
variants. So not only ARM or AVR, but also STM8 and other compilers of IAR. The author of this extension only uses ARM, AVR and STM8, but when
users find issues for other IAR compilers, open an issue on Github. In case you open an issue, please report the used compiler with its version and if possible the ewp file.

The plugin can parse *ewp* files and convert them to a valid `c_cpp_properties.json` configuration which is used by the *cpptools* extension made by *Microsoft*.
In the `Features` section you can find more information how to use this extension.

## Features

### Configuring the extension

It is adviced to use the extension UI to configure the extension. The UI are statusbar items which will execute a command when clicking on them.

![Status bar](images/readme/statusbar.png)

You can also call the commands behind those buttons, see the `contribution` tab in the extension section of VS Code.

### Building

When you execute the VSCode command `Tasks: Configure Task` two items are added which are gnerated by this extension:

1. `iar: IAR Build - template using selected workbench, project and config`
2. `iar: IAR Rebuild - template using selected workbench, project and config`

When selecting one of the two, a default task is generated which uses the workbench, project and configuration selected using the UI. When you select a different configuration, project or werkbench, this script will use the newly selected items.

#### Depracated Method: Create manually

In previous plugins there was a build command. However, from now on you can create a task because all necessary information is available through settings. You can use the following snippets to create a `build` and `rebuild` command. In alpha2 or beta1 will contain a `problem matcher`. Use the following template as a starting point:
```
{
    // See https://go.microsoft.com/fwlink/?LinkId=733558
    // for the documentation about the tasks.json format
    "version": "2.0.0",
    "tasks": [
        {
            "label": "IAR Build",
            "type": "process",
            "command": "${config:iarvsc.workbench}\\common\\bin\\IarBuild.exe",
            "args": [
                "${config:iarvsc.ewp}",
                "-make",
                "${config:iarvsc.configuration}"
            ],
            "problemMatcher": [
                "$iar-cc",
                "$iar-linker"
            ],
            "group": {
                "kind": "build",
                "isDefault": true
            }
        },
        {
            "label": "IAR Rebuild",
            "type": "process",
            "command": "${config:iarvsc.workbench}\\common\\bin\\IarBuild.exe",
            "args": [
                "${config:iarvsc.ewp}",
                "-build",
                "${config:iarvsc.configuration}"
            ],
            "problemMatcher": [
                "$iar-cc",
                "$iar-linker"
            ]
        }
    ]
}
```

Improvements are welcome through *pull requests* or *issue reports*.

### Debugging

In v1.1.0-beta1 settings are added to configure a gdbserver and a gdb executable. The following data for the `launch.json` file will use this configuration to start debugging. Currently this is only for testing and is work in progress. The settings are nog yet automatically updated when selecting different projects or confiugrations (even though the description of the settings mention this).

```
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Debug GDBServer",
            "type": "cppdbg",
            "request": "launch",
            "program": "${config:iarvsc.outFile}",
            "stopAtEntry": true,
            "cwd": "${workspaceRoot}",
            "externalConsole": true,
            "MIMode": "gdb",
            "miDebuggerPath": "${config:iarvsc.debugger}",
            "debugServerPath": "${config:iarvsc.gdbServer}",
            "debugServerArgs": "${config:iarvsc.gdbServerArgs",
            "serverStarted": "Connected\\ to\\ target",
            "serverLaunchTimeout": 5000,
            "filterStderr": false,
            "filterStdout": true,
            "setupCommands": [
                {
                    "text": "target remote localhost:3333"
                },
                {
                    "text": "monitor flash breakpoints = 1"
                },
                {
                    "text": "monitor flash download = 1"
                },
                {
                    "text": "monitor reset"
                },
                {
                    "text": "load \\\"${config:iarvsc.outFile}\\\""
                },
                {
                    "text": "monitor reset"
                }
            ]
        }
    ]
}
```

## Requirements

This extensions presumes that you have installed `cpptools` of `microsoft`.

## Extension Settings

This extension contributes the following settings:

* `iarvsc.iarInstallDirectories`: The rootfolders where all IAR workbenches are installed. By default this is `C:\Program Files (x86)\Iar Systems`. The default settings contain also the non-x86 folder in case IAR will move to 64-bit installations.
* `iarvsc.workbench`: The last selected workbench in this workspace.
* `iarvsc.compiler`: The last selected compiler.
* `iarvsc.ewp`: The last selected project file.
* `iarvsc.configuration`: The last selected configuration.
* `iarvsc.defines`: Some custom defines you can add to the define list. They folow the `identifier=value` structure. This list will contain all intrinsic compiler functions that are known by the author of this extension. If some are missing, create a GitHub issue.

An important note for the settings `iarvsc.workbench`, `iarvsc.compiler`, `iarvsc.ewp`, `iarvsc.configuration`:
Those values get overwritten by the extension when invalid values are defined or you select different values using the extension UI (the status bar items) or commands.

## Known Issues

## Release Notes

### 1.1.0-beta1

* Implement #28: Add support to generate build tasks using the VSCode built-in command `Tasks: Configure Task`.
* Fix #18: Save all files before build. (this is actually fixed because we are now using tasks)
* Add settings to test a generic launch script to start debugging.

### 1.0.0

* Add __root to default defines
* Add keywords so the extension is easier to find in the marketplace

### 1.0.0-beta1

* Add listeners to the define settings so the cpptools config file is generated when changed
* Fix issue when cpptools config file is empty or invalid: plugin would not load
* Add some more settings for default c and c++ standard configuration

### 1.0.0-alpha2

* Correct relative include paths in cpptools config file
* Add `=` sign to default defines in settings
* Add a problem matcher

### 1.0.0-alpha1

* Redisgned the extension
* Instead of completely command drive, status bar items are added to configure most things
* Automatically monitor the selected ewp file and auto generate the config file
* Only generate one config file `IAR` in the `c_cpp_properties.json` file. Changing between projects/configurations will
  automatically trigger an update of the `IAR` config section in the json file.
* Move all settings from iar-vsc.json to the configuration file of vscode. This way configurations are reusable.
* Make extension platform aware so you can choose from all compilers from the selected workbench.
* Add new setting to define your own `defines` through the IAR settings. This way it is possible to define the intrinsics
  of your compiler so you do not have to wait for extension updates.
* Add command to open IAR workbench. For now only the workbench opens without a workspace. See Issue #24 @ GitHub.
* Extension is now loaded when the workspace contains `.ewp` files.
* Added basic unit- and integrationtests.
* Probably a lot more...

### 0.0.3

* Fixes #1: Extension did not detect end of build command
* Fixes #3: Renamed iar-vsc.js to iar-vsc.json

### 0.0.2

Add system include paths

### 0.0.1

Initial release of iar-vsc


## Road Map

Check the github project page for more information about the roadmap.
