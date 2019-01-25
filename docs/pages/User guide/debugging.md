---
layout: default
title: Debugging
nav_order: 4
parent: User guide
permalink: /user-guide/debugging
---

# Debugging

Since version `v1.1.0-beta1` settings are added to configure a gdbserver and a gdb executable. The following data for the `launch.json` file will use this configuration to start debugging. Currently this is only for testing and is work in progress. The settings are nog yet automatically updated when selecting different projects or configurations (even though the description of the settings mention this).

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
