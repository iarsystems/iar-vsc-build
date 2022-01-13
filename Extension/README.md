## Using the build script

This folder includes a `build.rb` script to build the extension using Rake (https://github.com/ruby/rake)
The `build.rb` script will install packages, pull thrift definitions and build the project
all at once. See `ruby build.rb --help`.

This is used internally at IAR for continous integration and is currently not usable outside of the
company network.

In order to rebuild the Apache Thrift extensions you will need a patched version of the Thrift compiler,
which is currently not included in this folder (only the Jenkins server has it).

Once built, you can run/debug the extension by opening this folder in VS Code and pressing `F5`.

The build script will also produce an installable `.vsix` file, see
[instructions here](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix)
for how to install it.
