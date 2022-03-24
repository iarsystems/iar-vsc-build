# IAR Build - Handling IAR language extensions

* [Getting started](README.md)
* [Building projects and running C-STAT](building.md)
    * [Configuring build parameters](building.md#configuring-build-parameters)
* [Adding and removing project files](project-files.md)
* **Handling IAR language extensions**
* [Adding IAR Embedded Workbench/Build Tools installations](adding-toolchains.md)
* [Productivity tips](productivity.md)

---

This extension relies on the [C/C++](https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools) extension for code indexing and real-time diagnostics.
Because the C/C++ extension does not support IAR language extensions, code that uses extended language features can be improperly parsed or display false errors.

This extension helps by defining preprocessor macros for some extended keywords,
that force the indexer ignore the keywords.
The `Defines` extension setting can be used to define additional macros visible only to the indexer.

The `@` operator is especially problematic, since it is not a valid identifier and cannot be defined as a macro. To avoid errors, you may rewrite expressions using `#pragma location` instead:

> Example

If refactoring the code is not an option (e.g. because the `@` operator is used in your device headers),
the best option is to set Error Squiggles to `Disabled` in the C/C++ extension and rely on diagnostics from the provided build tasks instead.