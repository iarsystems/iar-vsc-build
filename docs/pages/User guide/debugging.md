---
layout: default
title: Debugging
nav_order: 4
parent: User guide
permalink: /user-guide/debugging
---

# Debugging

In v1.1.0 settings are added to configure a gdbserver and a gdb executable. The following data for
the `launch.json` file will use this configuration to start debugging. Currently this is only for
testing and is work in progress. The settings are nog yet automatically updated when selecting
different projects or confiugrations (even though the description of the settings mention this).

Open or create the `launch.json` file and place your cursor at the beginning of the configurations
array. Now press `Ctrl + Space` to activate autocompletion. You should see an item like
`IAR: Debug using gdb server`. If you select this, the configuration below is automatically
generated.

Some information about the used config parameters:

* `iarvsc.outFile`: The path to the output file to flash on the target. Use a path relative from
  your workspace folder and use the following construction for the *program* property of the launch
  config: `${workspaceFolder}/${config:iarvsc.outFile}`.
* `iarvsc.debugger`: The path to the debugger to use. In case your debugger is on your `PATH`
  environment you can just enter the debugger executable like `arm-none-eabi-gdb.exe`, otherwise,
  use the absolute path to the debugger.
* `iarvsc.gdbServer`: The path to the gdb server. If you are using a J-Link Segger, you will
  probably have to enter the full path like: `C:\GNU Tools ARM Embedded\2018-q4-major\bin\arm-none-eabi-gdb.exe`.
  Keep in mind you have to escape the *backslashes* `\` in *json*.
* `iarvsc.device`: The device you are want to *flash* and *debug*. Check your *debug server*
  documentation which values you can use here.

```[json]
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Debug GDBServer",
            "type": "cppdbg",
            "request": "launch",
            "program": "${workspaceFolder}/${config:iarvsc.outFile}",
            "stopAtEntry": true,
            "cwd": "${workspaceFolder}",
            "externalConsole": true,
            "MIMode": "gdb",
            "miDebuggerPath": "${config:iarvsc.debugger}",
            "debugServerPath": "${config:iarvsc.gdbServer}",
            "debugServerArgs": "-if swd -singlerun -strict -endian little -speed auto -port 3333 -device ${config:iarvsc.device} -vd -strict -halt",
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
