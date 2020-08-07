# iar-vsc-thrift README

This is a modified version of `iar-vsc`, providing some thrift project integration.
Note that is **not** the actual development repo for this project, I just put this here to make it easier for others to find it.
The actual repo is on my (private) github for now.

## Building

First, install a somewhat recent version of Node.js.
The `build.rb` script will install packages, pull thrift definitions and build the project
all at once. See `ruby build.rb --help`.
Note that you will need my patched thrift compiler for it to work, which you can also find
[in my repo](http://git.iar.se/gitweb.cgi?p=user/hampusad.git;a=tree;f=thrift-for-ts;h=94332711f2c6536b64ad0603a5468c4cf52450ad;hb=HEAD).
If you've cloned the entire repo, the build script should find it automatically.

Once built, you can run/debug the extension by opening this folder in VS Code and pressing `F5`.
The build script will also produce an installable `.vsix` file, see
[instructions here](https://code.visualstudio.com/docs/editor/extension-gallery#_install-from-a-vsix)
for how to install it.
