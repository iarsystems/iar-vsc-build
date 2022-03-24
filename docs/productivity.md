# IAR Build - Productivity tips

* [Getting started](README.md)
* [Building projects and running C-STAT](building.md)
    * [Configuring build parameters](building.md#configuring-build-parameters)
* [Adding and removing project files](project-files.md)
* [Handling IAR language extensions](language-extensions.md)
* [Adding IAR Embedded Workbench/Build Tools installations](adding-toolchains.md)
* **Productivity tips**

---

## Setting a default build task
To avoid having to access the `Run Task...` menu every time you want to build your project, you can configure
a default build task. The default build task can be run with a keyboard shortcut (default `ctrl+shift+b`).

To configure a default build task, go to `Terminal->Configure Default Build Task...` and select the `iar: Build Project` task.

## Switching between VS Code and IAR Embedded Workbench
If you often switch back and forth between VS Code and IAR Embedded Workbench,

To go from VS Code to IAR Embedded Workbench, simply run the task `iar: Open Workspace in IAR Embedded Workbench`. This will open
an IAR Embedded Workbench workspace (`.eww` file) from your current VS Code workspace.

To go from IAR Embedded Workbench,

> Instruktioner finns [här](https://www.iar.com/knowledge/support/technical-notes/general/using-visual-studio-code-with-iar-embedded-workbench/),
> det är nog bäst att kopiera dem hit eftersom resten av artikeln är utdaterad.


## Changing project & configuration using the keyboard
If you prefer using the keyboard over the mouse and want to quickly change the active project or configuration, the extension provides
commands that you can run from the command palette. Press `F1` or `ctrl+shift+p` and search for `IAR: Select Project` or `IAR: Select Configuration`.