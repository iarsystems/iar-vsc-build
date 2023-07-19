# BasicProject

We use this project to create barebone projects for specific targets to test building.
This project needs to be placed separately, so that it is not copied to the folder we then open in vs code.
The ewp file is invalid before we edit it from our tests, so if we attempt to load it with a debug EW build it will crash the
project manager and mess with our tests.
