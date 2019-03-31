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

Branches
--------

There are *two* important branches when contributing:

#. ``master``
#. ``dev``

You should start from one of those two branches. The difference is that the ``master`` branch is more *stable*, but I also expect when receiving a pull request on the ``master`` branch that everything is done by the contributor. The following list of items is a start of requirements your pull request should satisfy:

* Feature fully tested
* Style is ok
* Documentation is up-to-date (including this sphinx documentation)

If one of these items are not satisfied, then I will try to merge on the ``dev`` branch. If this is not possible, I will ask to either fix the pull request to meet the above items or rebase to the ``dev`` branch.

On the ``dev`` branch, I tolerate that some of the above items are missing. It is a dev branch, so it is still under development. However, this branch is less stable than the master branch. Not only the features on this branch, but also the history. It is possible that from time to time I will cleanup the history. I will try to keep this to a minimum, but keep in mind this could happen.

There is also a third branch, ``pluyckx``. This is my personal ``dev`` branch. I advise to not contribute on this branch. The history will change a lot, and it will contain experiments. At home I am not really using ``IAR``, so I have to test things at the office. This branch is used to share changes.

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
