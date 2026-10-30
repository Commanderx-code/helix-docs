# Helix Tech Docs

The documentation site for the Helix tools, at https://docs.helixtech.app.

The pages are not kept here. Each build downloads the latest release of each
tool repository (or `main` for a tool without a release) and turns a fixed
list of its documentation pages into this site. To change a page, edit it in
the tool's repository; the "Edit this page" link at the bottom of every page
goes there.

- `scripts/sources.mjs` lists the tools and the pages taken from each.
- `scripts/fetch-docs.mjs` downloads and converts them.
- `scripts/check-dist.mjs` checks the built site before it is published.

## Build

```sh
npm ci
npm test
npm run build
```

The site is built with [Starlight](https://starlight.astro.build) and published
by GitHub Actions to the `deploy` branch, which the server pulls.

## License

MIT. Each tool's documentation is under that tool's license.
