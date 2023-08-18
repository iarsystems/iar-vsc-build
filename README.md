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

This extension is compatible with any IAR Embedded Workbench (EW) or IAR Build Tools version (BX) using IDE version 8 or newer. The table below helps you find the extension version supporting your IAR Embedded Workbench product.
The supported versions are the same for IAR Build Tools installations, but IAR Build Tools does not support the file view or adding/removing files from a project.

<details><summary>IAR EW/BX - Compatibility table</summary>

| IAR EW/BX version  | Limitation
|--------------|---------
| Arm v9.30.1 or later <br>RISC-V v3.10 or later <br>RH850 v3.10 or later <br>RL78 v5.10 or later <br>AVR v8.10 or later <br> RX v5.10 or later | None |
| Arm v9.20.4 | Batch builds do not persist to the workspace file. |
| Arm v8.10-9.20.3<br>RISC-V v1.10-2.11<br>430 v7.10 or later<br>RL78 v3.10 or later<br>RX v3.10 or later<br>RH850 v2.10-2.21<br>AVR v7.10 or later<br>8051 v10.10 or later<br>| File view and possibility to add/remove files from a project is not supported. Batch builds do not persist to the workspace file. |

</details>

## Feedback

Depending on which feedback you want to share with us, here are the preferred options:

* If you have ideas on how to improve this extension or if you have found issues with it, see [CONTRIBUTING.md](https://github.com/IARSystems/iar-vsc-build/blob/master/CONTRIBUTING.md) on how to proceed.

* If you have issues with the underlying IAR Embedded Workbench or IAR Build Tools product, report this via the IAR Systems technical support channel at [IAR Technical Support](https://www.iar.com/knowledge/support/).

<!-- ## Contributions
Contributions are always welcome. Or did we decide to have a read-only repository? -->
