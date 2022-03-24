# IAR Build - Building projects and running C-STAT

* [Getting started](README.md)
* **Building projects and running C-STAT**
    * Configuring build parameters
* [Adding and removing project files](project-files.md)
* [Handling IAR language extensions](language-extensions.md)
* [Adding IAR Embedded Workbench/Build Tools installations](adding-toolchains.md)
* [Productivity tips](productivity.md)

---

This extension provides [Tasks](https://code.visualstudio.com/Docs/editor/tasks) for performing build operations on a project.

The tasks can be accessed from the `Terminal` menu by clicking `Run Task...`.

This extension provides the following task categories:
* `iar` - ...
* `iar-cstat` - ...


## Configuring build parameters
By default, the provided tasks will use the currently selected project and configuration. If you want to set up tasks to build a specific project or configuration, you can *configure* one or more tasks.

> Här kanske vi kan hänvisa till [VS Codes dokumentation](https://code.visualstudio.com/Docs/editor/tasks#_customizing-autodetected-tasks), men jag tycker inte den är jättetydlig.

An example `tasks.json` file with a configured `Build Project` task:

```json
{
	"version": "2.0.0",
	"tasks": [
		{
			"type": "iar",
			"command": "build",
			"project": "${workspaceFolder}/MyProject.ewp",
			"config": "*",
			"builder": "${command:iar-settings.toolchain}/common/bin/iarbuild.exe",
			"label": "Build MyProject",
            "extraBuildArguments": [
                "-parallel",
                "8"
            ],
			"problemMatcher": [
				"$iar-cc",
				"$iar-linker"
			]
		}
	]
}
```
Running this task will build all configurations for the `MyProject.ewp` file in the workspace folder.

> Om vi vill ha referensinformation för fälten i `tasks.json` så finns det i package.json. Samma information dyker upp när man redigerar `tasks.json` (genom autocompletion och tooltips), så den behövs kanske inte här.