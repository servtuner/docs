# servtuner documentation

The documentation site for [servtuner](https://github.com/servtuner/servtuner), a benchmarking platform for LLM
serving on Kubernetes. Built with [Astro Starlight](https://starlight.astro.build/) and hosted on GitHub Pages at
<https://docs.servtuner.dev/>.

## Local development

Use Node.js 24 or newer.

```sh
npm ci
npm run dev       # http://localhost:4321/
npm run build     # writes dist/
npm run preview
```

Pages are in `src/content/docs`. Write internal links from the site root, such as `/guides/runspecs/`.

## Checks

| Command                  | What it checks                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `npm run check`          | Types, formatting, page titles and descriptions, and examples against servtuner's schemas  |
| `npm run check:links`    | Internal links, anchors and assets of the built site                                       |
| `npm run check:coverage` | That every command, endpoint, schema, chart value and UI area is documented                |
| `npm run check:privacy`  | Secrets and private details in the source and the built site                               |
| `npm run check:browser`  | Console errors, page overflow, themes and search, in an installed Chrome (`CHROME=<path>`) |

Build before any check except the first. To also run every RunSpec example through servtuner's own validator, set
`BENCH` to a servtuner binary: `BENCH=/path/to/servtuner npm run check`.

Put `{/* schema: runspec */}` above a JSON or YAML block to validate it. The name is a file in
`src/data/servtuner/schemas`, or `openapi:<Model>`. Every RunSpec must be annotated.

## Sync with servtuner

The pages for the CLI, API, RunSpec, schemas, Helm values and environment are generated from a servtuner checkout.
With Git and a Go toolchain:

```sh
npm run sync -- /path/to/servtuner            # its HEAD commit
npm run sync -- /path/to/servtuner --ref SHA  # a chosen commit
```

The script exports committed files to a temporary directory, so it never writes to the checkout and ignores uncommitted
work. It records the commit in `src/data/servtuner/meta.json`. Afterwards, review the handwritten pages against the
changes, then run every check.

## Versions and releases

The published site has one version per servtuner release line, chosen by servtuner's tags:

| URL                   | Content                                                     | Built from                       |
| --------------------- | ----------------------------------------------------------- | -------------------------------- |
| `/`                   | The latest stable release                                   | The newest release line's branch |
| `/v0.3/`, `/v0.2/`, … | Every release line, including the latest                    | Branch `v0.3`, `v0.2`, …         |
| `/next/`              | Unreleased servtuner (main), marked as such and not indexed | `main`                           |

- A release is a tag `vMAJOR.MINOR.PATCH` exactly. Pre-releases (`v0.4.0-rc.1`) never become latest, and `main` is
  never at `/`. Before the first release, `/` says there is no release yet and links to `/next/`.
- Each release line's branch holds that line's pages, with the reference synced from its newest release.
- A picker on every page, and a banner on every version but the latest, read `/versions.json` when the page loads,
  so older versions list releases made after them.

**When you tag a servtuner release** (`v0.4.0`, or a patch such as `v0.4.1`):

```sh
npm run cut-version -- /path/to/servtuner v0.4.0   # creates or updates the branch v0.4, synced from the tag
git log v0.4                                       # review
git push origin v0.4                               # the workflow rebuilds and publishes every version
```

To fix the docs of an older line, commit to its branch and push it. To see the whole site locally:

```sh
npm run build:site -- /path/to/servtuner --checks  # every version, in site/, with every check
node scripts/serve.mjs 4321 site                   # http://127.0.0.1:4321/
```

`npm run versions -- https://github.com/servtuner/servtuner` prints which versions the site would publish. A single
build follows `DOCS_BASE`, `DOCS_VERSION` and `DOCS_INDEXED` (see `scripts/lib/site.mjs`).

## Publish

`.github/workflows/site.yml` checks every push and pull request. Pushes to `main` and to the release branches build
every version and deploy them to GitHub Pages. `public/CNAME` names the custom domain, `docs.servtuner.dev`. Allow the
`v*` branches in the `github-pages` environment's deployment branches, or pushes to them are not deployed.

## License

Copyright 2026 The servtuner Authors.

- Code, configuration and code examples, including those inside pages: [Apache License 2.0](LICENSE).
- Documentation text, diagrams and images: [CC BY 4.0](LICENSE-docs).

Neither license covers the servtuner name and logo.
