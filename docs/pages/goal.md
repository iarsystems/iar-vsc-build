---
layout: default
title: Goal
nav_order: 0
has_children: false
permalink: /goal
---

{% include references.md %}

# Goals

In this document I want to try to explain what the goals are for this extension.
The *Core* section contains the goals with which this extension was started.
Later the *Additional* goals were added to make the extension more productive
and reduce the needs to switch between tools. Like every tool/extension, it is
not finished in one release. Some goals are already defined, but the features
are not implemented yet. Those goals are found in the *Future* section.

## Core

When using the embedded compiler toolchain of IAR, you are forced to use the
Workbench that is bundled with the compiler. This workbench is not ideal and
lacks a lot of features that you expect an *IDE* should provide. Some of those
features is a good behaving *auto complete*, easy to switch between files. This
plugins tries to make it possible to develop in VSCode instead of the Workbench.

VSCode has an extension that provide autocomplete etc for C/C++ projects. This
plugin can be found [here][ms-cpptools] (`cpptools`). However, the IAR toolchain
uses its own project files (*.ewp*) which contain the necessary configuration
(*defines*, *includes*, ...). `cpptools` cannot read this ewp file directly.
This plugin tries to tackle this issue.

This plugin can interpret those *ewp* files and read the necessary
configurations. The plugin will add a build configuration for the `cpptools`
extension so it has all information it needs to provide the needed features to
develop embedded applications.

## Additional

The above description explains the base support this extension wants to provide.
However, with the support explained above, you would still need to switch a lot
between IAR workbench and VSCode:

* Develop using VSCode and write code
* Compile in IAR Workbench
* Fix compile issues in VSCode/IAR Workbench
* Debug in IAR Workbench

To minimize the need to switch between work tools, this plugins tries to
integrate as much as possible with the IAR toolchain. Starting from v1.0.0 there
is an easy way to generate *build tasks* that call the IAR compiler toolchain
with the selected *project file* and selected *configuration*. The compiler
output is parsed and *errors* and *warnings* are added to the *PROBLEMS* view of
VSCode. This makes it possible to also execute the three first points from
VSCode instead you have to switch between tools.

Debugging is a harder issue to tackle. The extension will provide some snippets
for the `launch.json` file, so it is easy to start a debugging session. This
won't work for everyone. The embedded world uses very specific debugging tools
and there are a lot of them. The snippets currently provided by this extension
uses the Segger J-Link debug interfaces. This does not mean you cannot use other
interfaces. This does mean you need to create the `launch.json` scripts
yourself. The snippets for the Segger debuggers can help to setup your own
*launch configurations*. When you have created a *launch configuration* for
another kind of debugger, you are always welcome to share it with me by creating
an issue on the [Github issues page][github-issues] of this extension. Then I
will add the snippet to this extension.

## Future

Most what is said above is already available in v1.0.0 of the extension. This
does not mean everything that is possible is implemented. Sometimes it is still
necessary to switch between VSCode and IAR Workbench. For example:

* Create a new project
* Modify include paths
* Modify defines
* Add new c files
* ...

Some use cases will be hard to implement through this extension (*Create a new
project*), while other are feasible to do when the *ewp* file is already
available, like modify include pahts, defines, c files inside the project. These
are some features that are currently on the roadmap to be implemented.
