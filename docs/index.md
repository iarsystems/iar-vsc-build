---
layout: home
---

# IAR-VSC

Welcome to the `IAR-vsc` documentation. The `IAR-vsc` plugin makes it possible to combine the IAR compiler solutions with Visual Studio Code. The goal is that this plugin supports all compiler
variants. So not only ARM or AVR, but also STM8 and other compilers of IAR. The author of this extension only uses ARM, AVR and STM8, but when
users find issues for other IAR compilers, open an issue on Github. In case you open an issue, please report the used compiler with its version and if possible the ewp file.

The plugin can parse *ewp* files and convert them to a valid `c_cpp_properties.json` configuration which is used by the *cpptools* extension made by *Microsoft*.

See the [User Guide](/user-guide) for how to use this plugin.
If you would like to contribute, please see the [Contribution guide](/contributing).

The source of this project is hosted on [Github](https://github.com/pluyckx/iar-vsc).

If you find any issue, please submit it at through [github issues](https://github.com/pluyckx/iar-vsc/issues).