# Catalog tools

Keeps `catalog/apps/*.json` — the one-click app catalog — honest over time.
Plain Node ESM, no dependencies; run any script directly with `node`.

| Command | What it does |
| --- | --- |
| `npm run catalog:validate` | Checks every manifest against the shape the seeder and the web UI expect |
| `npm run catalog:check-images` | Resolves every image reference (including the ones inside compose documents) against its registry |
| `npm run catalog:sync` | Compares the catalog against [awesome-selfhosted-data] and prints a report |

Those npm scripts live in the repo root `package.json`; inside this directory
the equivalents are `npm run validate`, `npm run check-images` and `npm run sync`.

## Why sync does not write manifests

awesome-selfhosted-data tracks *projects*, not *deployments*. It has the name,
description, licence, star count and release tag — but no image name, port,
volume layout or environment variables. Everything needed to actually install
an app has to be written by a human, so `sync.mjs` produces a report and stops
there. Its job is to tell you which apps deserve attention, not to guess.

The report has three sections:

- **Needs attention** — shipped apps whose upstream project was archived, went
  quiet for six months, or disappeared from the list. This is the part worth
  acting on, and the only part that makes the script exit non-zero.
- **Pinned version behind upstream** — apps where we pin an explicit version
  and upstream has since released a newer one. Apps on a floating tag such as
  `:latest` are skipped, because comparing those to a release number is
  meaningless.
- **Candidates** — popular, actively developed projects we do not ship yet,
  ranked by stars, with their upstream tags and platforms so you can judge
  whether one is worth packaging.

Flags: `--candidates N` (default 25), `--offline` to reuse the cached upstream
checkout, `--json`, and `--out FILE`.

Upstream is shallow-cloned into `.cache/` on first run and refreshed after
that. The YAML there is machine-generated and uses a tiny subset of the format,
so `yaml.mjs` parses it directly rather than pulling in a dependency; it throws
on anything outside that subset so a format change fails loudly.

## Manifest fields

`validate.mjs` is the source of truth, but the two checks that matter most are
the ones that fail *silently* at runtime rather than at build time:

- `icon` must exist in `apps/web/src/components/catalog-icons.tsx`. An unknown
  token quietly renders as a blank fallback box.
- `category` must have a `catalog.category.<name>` key in **both** `en.ts` and
  `ru.ts`. A missing key shows the raw English string to Russian users.

Every manifest also carries `upstream`: the awesome-selfhosted id used to track
it, or the string `none` for apps that are not listed there (Grafana, MinIO,
Uptime Kuma and the `whoami` demo). Without it `sync.mjs` cannot follow the app.

[awesome-selfhosted-data]: https://github.com/awesome-selfhosted/awesome-selfhosted-data
