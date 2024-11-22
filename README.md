# IAR Build

Build and develop your IAR Embedded Workbench projects from Visual Studio Code.

* Build projects
* Manage project files
* Generate C-STAT messages and reports
* Use language features powered by the [C/C++ extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools)

An IAR Embedded Workbench or IAR Build Tools installation is required to use this extension. See [Compatibility](#compatibility) table below for detailed information.

> 💡️ To debug your Embedded Workbench projects from VS Code, please also see the [IAR C-SPY Debug extension](https://marketplace.visualstudio.com/items?itemName=iarsystems.iar-debug).

## Getting started

To get started, open a folder containing an IAR Embedded Workbench project.
A view with an IAR Embedded Workbench icon will appear in the left side panel:

![side bar view](https://raw.githubusercontent.com/IARSystems/iar-vsc-build/master/images/readme/sidebar.png)

Here you may select the desired IAR Embedded Workbench/Build Tools installation,
and the project and project configuration you want to work with. If your IAR Embedded Workbench or IAR Build Tools installation
is not found automatically, please see [Adding IAR Embedded Workbench/Build Tools installations](https://github.com/IARSystems/iar-vsc-build/blob/master/docs/README.md).

To build or analyze the selected project configuration, go to `Terminal->Run Task...` and then select either the `iar` or `iar-cstat` category.
To make this easier, you may wish to [Add a default build task](https://github.com/IARSystems/iar-vsc-build/blob/master/docs/README.md#setting-a-default-iar-build-task).

## Documentation

* [Configuring the Build extension](https://github.com/IARSystems/iar-vsc-build/blob/master/docs/README.md#ConfigExtension)

* [Making IAR Build settings](https://github.com/IARSystems/iar-vsc-build/blob/master/docs/README.md#iarbuildsettings)

* [Switching between VS Code and IAR Embedded Workbench](https://github.com/IARSystems/iar-vsc-build/blob/master/docs/README.md#SwitchingVSCodeEW)

* [Adding and removing source files](https://github.com/IARSystems/iar-vsc-build/blob/master/docs/README.md#AddingRemovingFiles)

* [IAR Build tasks](https://github.com/IARSystems/iar-vsc-build/blob/master/docs/README.md#IARBuildTasks)

* [Configuring build parameters](https://github.com/IARSystems/iar-vsc-build/blob/master/docs/README.md#ConfigBuildParameters)

* [IAR language extensions](https://github.com/IARSystems/iar-vsc-build/blob/master/docs/README.md#IARLanguageExtensions)

[Click here](https://github.com/IARSystems/iar-vsc-build/blob/master/docs/README.md) to view the full documentation.

## Compatibility

This extension is compatible with any versions of IAR Embedded Workbench (EW) or IAR Build Tools (BX) installations using IDE version 8 or newer.

The table below lists known limitations concerning earlier versions of both IAR products for each supported target architecture. Note that BXARM 9.30.1-9.32.1 do not support the *Files* view, otherwise the supported versions are the same for IAR Embedded Workbench and IAR Build Tools installations.

| Target architecture | Product Version | Known Limitation
|---------------------|-----------------|-----------
| Arm<br>RISC-V<br>430<br>AVR<br>RH850<br>RL78<br>RX | v9.30.1 or later <br>v3.10.1 or later <br>v8.10.1 or later <br>v8.10.1 or later <br>v3.10.1 or later <br>v5.10.1 or later <br>v5.10.1 or later | None.
| Arm | v9.20.4 | Batch builds do not persist in the workspace file.
| Arm<br>RISC-V<br>430<br>AVR<br>RH850<br>RL78<br>RX<br>8051 | v8.10.1-9.20.3 <br>v1.10.1-2.11.1 <br>v7.10.1-7.21.1 <br>v7.10.1-7.30.5 <br>v2.10.1-2.21.1 <br>v3.10.1-4.21.4 <br>v3.10.1-4.20.3 <br>v10.10.1 or later | - Batch builds do not persist in the workspace file.<br>- Adding/Removing files from a project is not supported.<br>- Files view is not supported.

## Feedback

Depending on the type of feedback you want to share with us, here are our preferred options:

* For urgent matters with the extension, or if you have issues with the underlying IAR Embedded Workbench or IAR Build Tools product, report them via the [IAR Technical Support](https://www.iar.com/knowledge/support/request-technical-support/) channel.

* For other matters isolated to this extension, file a [New issue](https://github.com/IARSystems/iar-vsc-build/issues/new/choose) using the provided template. We will reply on a "best effort basis".

* If you have ideas on how to improve this extension, see [CONTRIBUTING.md](https://github.com/IARSystems/iar-vsc-build/blob/master/CONTRIBUTING.md) on how to proceed.
