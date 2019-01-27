# Documentation
The documentation is generated using [jekyll](https://jekyllrb.com/), GitHub can automatically build and serve the site from the markdownfiles as long as they are in the `docs` folder on the `master` branch ([more info](https://help.github.com/articles/configuring-a-publishing-source-for-github-pages/#publishing-your-github-pages-site-from-a-docs-folder-on-your-master-branch)).

## Developing locally
To develop locally you need the following dependencies:

* [`ruby`](https://www.ruby-lang.org/en/downloads/) 
* [`bundler`](https://bundler.io/)

After this you can install all dependencies with:

```bash
bundle install --path vendor/bundle
bundler exec jekyll serve
```

### Possible Issues

When running `bundler exec jekyll serve` you can get a warning that the file `head.html` isn't found. This is because in
the _config.yml a *remote theme* is used. On line *28*, comment out `remote_theme: pmarsceill/just-the-docs` and
uncomment line *29* `theme: just-the-docs`.