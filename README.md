# iar-vsc README

This plugin make it possible to combine the IAR compiler solutions with Visual Studio Code. The goal is that this plugin supports all compiler
variants. So not only ARM or AVR, but also STM8 and other compilers of IAR. The author of this extension only uses ARM, AVR and STM8, but when
users find issues for other IAR compilers, open an issue on Github. In case you open an issue, please provide an *ewp* file which reproduce the
issue and the used compiler with its version.

The plugin can parse *ewp* files and convert them to valid `c_cpp_properties.json` which are used by the *cpptools* extension made by *Microsoft*.
Commands are available to help you configure this extension. In the `Features` section you can find more information about them.

## Features

Images follow later, for now the features are explained using textual format only.

### Configuration Commands

There are five commands available at the moment. Three help you configure the extension to generate the `c_cpp_properties.json` file. Two are used
to compile the project using the IAR compiler.

#### IAR: Select Installation

With this command the extension searches for available IAR installations. This can take a couple of seconds depending on how many IAR solutions
you have installed. It uses the folders specified in the `iarvsc.iarRootPaths` extension setting. By default they point to
`C:\Program Files\IAR Systems` and `C:\Program Files (x86)\IAR Systems`. By default IAR installs their software in those two folders. If you use
different folders, update this setting with the correct values.

A *quick pick list* is shown. When selecting an IAR installation, the path is stored in `.vscode\iar.json` file. So you can also specify the path
manually if needed.

#### IAR: Select Project

This command searches your workspace for *ewp* files. A *quick pick list* is shown with all found projects. When you select a project file, its path
is stored in the `.vscode\iar.json` file.

#### IAR: Sync Project File

When you have selected an IAR installation and an IAR project file, you can sync the file to the `c_cpp_properties.json` file. The ewp is parsed and
all found *include paths*, *defines* and *pre include files* are detected and written. Beside those settings, the compiler specific *defines* and
*system include pahts* are also detected and written.

The plugin will create a configuration for each found configurations. The name inside `c_cpp_propreties.json` are generated using the following format:
`IAR-{project file name}-{configuration}`.

#### IAR: Build

Executing the `Build` command will show you all available configurations in the *ewp* in a *quick pick list*. After selecting a build the extension calls
the `IarBuild.exe` command with the configured *ewp file* and the selected *configuration* from the quick pick list.

An output window is opened with the name *IAR* where the compiler output is shown.

#### IAR: Rebuild

The same as the `Build` command, except this command will first clean all output files.

## Requirements

This extensions presumes that you have installed `cpptools` of `microsoft`.

## Extension Settings

This extension contributes the following settings:

* `iarvsc.iarRootPaths`: Specify root paths where IAR software is installed. This setting accepts an array of paths (string).

## Known Issues

## Release Notes

### 0.0.1

Initial release of iar-vsc

### 0.0.2

Add system include paths

## Road Map

The following items are currently on the whish list to implement:
* Improve UI feedback
    * Let the user know when the extension is working (like when the *Select Installation* command is executing)
    * More checks if everything is configured and when something is wrong, give better information windows
* Update this README.md to use some animations to explain commands
* Create *tasks* so the compiler output is parsed by a *Problem Matcher* and shown in the *Problems* tab.
* Add commands to create *launch* commands to start a debugger using JLink.
* Sync changes made in c_cpp_properties.json back to the *ewp* file
