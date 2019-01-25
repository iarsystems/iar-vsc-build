---
layout: default
title: Settings
nav_order: 5
parent: User guide
permalink: /user-guide/settings
---

# Extension Settings

This extension contributes the following settings:

* `iarvsc.iarInstallDirectories`: The rootfolders where all IAR workbenches are installed. By default this is `C:\Program Files (x86)\Iar Systems`. The default settings contain also the non-x86 folder in case IAR will move to 64-bit installations.
* `iarvsc.workbench`: The last selected workbench in this workspace.
* `iarvsc.compiler`: The last selected compiler.
* `iarvsc.ewp`: The last selected project file.
* `iarvsc.configuration`: The last selected configuration.
* `iarvsc.defines`: Some custom defines you can add to the define list. They folow the `identifier=value` structure. This list will contain all intrinsic compiler functions that are known by the author of this extension. If some are missing, create a GitHub issue.

An important note for the settings `iarvsc.workbench`, `iarvsc.compiler`, `iarvsc.ewp`, `iarvsc.configuration`:
Those values get overwritten by the extension when invalid values are defined or you select different values using the extension UI (the status bar items) or commands.

## Advanced usage

Using the settings it is possible to automate other IAR tasks. You can for instance automate flashing the device or running tests in the simulator using the generated cspy scripts. These scripts are available in the `settings` folder present in the same folder as you `.ewp` file.