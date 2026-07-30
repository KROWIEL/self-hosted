# Catalog tools

Keeps `catalog/apps/*.json` — the one-click app catalog — honest over time.
Plain Node ESM, no dependencies; run any script directly with `node`.

| Command | What it does |
| --- | --- |
| `npm run catalog:validate` | Checks every manifest against the shape the seeder and the web UI expect |
| `npm run catalog:check-images` | Resolves every image reference (including the ones inside compose documents) against its registry |
| `npm run catalog:sync` | Compares the catalog against [awesome-selfhosted-data] and prints a report |
| `npm run catalog:import` | Regenerates the imported manifests from [Coolify]'s service templates |
| `npm run catalog:enrich` | Fills each manifest's `meta` block from [awesome-selfhosted-data] |

Those npm scripts live in the repo root `package.json`; inside this directory
the equivalents are `npm run validate`, `npm run check-images`, `npm run sync`
and `npm run import`.

## Where the apps come from

Two upstreams, for two different reasons.

**Coolify** publishes ~334 service templates, each with a working compose
document — the deployment data awesome-selfhosted deliberately does not track.
`import-coolify.mjs` converts them and writes the result to `catalog/apps/`,
which is how the catalog reaches 250+ entries. Every generated manifest carries
`"source": "coolify"`, and the importer only ever rewrites files with that tag,
so a hand-written manifest always wins and local fixes survive. Attribution for
the Apache-2.0 material is in the repo-root [`NOTICE`](../../NOTICE).

The importer drops a template rather than shipping something that cannot work:

- compose that trips the agent's policy — `privileged: true`, a mounted docker
  socket, or `network_mode: host` (mirrored from `internal/compose/policy.go`)
- reverse proxies and VPNs, which fight our own Traefik or need host networking
- entries with no usable port, since a wrong guess means a broken install
- Coolify's per-database duplicates (`gitea-with-mysql` and 47 others), keeping
  the plain app or, failing that, one preferred backend
- placeholder shapes the converter does not recognise, reported with the token

Flags: `--dry-run` to see that breakdown without touching anything, `--prune` to
delete generated manifests upstream has dropped, `--offline` to reuse the cache.

**awesome-selfhosted-data** feeds the details view and the tracking report.
`enrich.mjs` copies the long description, license, upstream links, star count
and last-commit date into each manifest's `meta` block — 131 of the apps are
listed there; the rest keep the documentation link Coolify supplies.

That data is resolved once, at build time, rather than when a card is opened.
The control plane may sit on a network with no outbound access, and fetching per
card would exhaust GitHub's 60-requests-an-hour anonymous budget in a single
page load. The details view therefore renders from the database alone and links
out for anything deeper.

Run order does not matter: the importer preserves an existing `meta` block and
`enrich.mjs` only rewrites that one key.

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
it, or the string `none` for apps that are not listed there. Without it
`sync.mjs` cannot follow the app.

`translations.ru` is optional — the UI falls back to the English text — but an
empty `ru` object is rejected, so it is either filled in or absent.

[awesome-selfhosted-data]: https://github.com/awesome-selfhosted/awesome-selfhosted-data
[Coolify]: https://github.com/coollabsio/coolify
