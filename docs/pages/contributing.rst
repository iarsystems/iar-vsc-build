.. This Source Code Form is subject to the terms of the Mozilla Public
   License, v. 2.0. If a copy of the MPL was not distributed with this
   file, You can obtain one at https://mozilla.org/MPL/2.0/.

Contributing
============

This extension is developed during the spare time of the author, so every contribution is welcome. Please take a look at the `issue list on github`_ for open issues. Maybe there is an item you can help with. For discussions there is a `gitter room`_.

.. _issue list on github: https://github.com/pluyckx/iar-vsc/issues
.. _gitter room: https://gitter.im/iar-vsc/community#

Developing
----------

The ``IAR-vsc`` plugin is written in *TypeScript*. It's not necessary to be an expert in this language to contribute (the author is also not an expert). Again, the `gitter room`_ is the place to be to ask questions and discuss things.

Testing
-------

In order to make sure the plugin keeps working, there is some testing to be done. To be honest, there are not a lot of tests at the moment, but I would like to change that. So I advise to write tests. There are different frameworks which help to write tests. Currently two modules are added which will help with writing tests:

* Mocha
* Sinon (ts-sinon)

The first module helps writing test *suites* and the *tests* themselves. The second helps mocking functions and modules. When writing tests, please use those two modules. If you want to use different modules or add more modules to help with some tasks, please discuss this first with the author.

Documentation
-------------

The documentation is created using `Sphynx`_ and hosted on `Read The Docs`_. When contributing, please update the documentation. Or at least give a good start so the author can finalize it. Update an already existing page, or start a new one if necessary.

.. _Sphynx: http://www.sphinx-doc.org/en/master/
.. _Read The Docs: https://readthedocs.org/

License
-------

All source files in this repository are released under the MPL 2.0 license. If you create new files, you have to add the license header to your source files. Probably you can just reuse a header from a file in the repository of the extension.
