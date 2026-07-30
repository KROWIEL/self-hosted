#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { APPS_DIR, ensureUpstream, loadManifests, loadUpstream } from './lib.mjs';

/**
 * Fill each manifest's `meta` block from awesome-selfhosted-data.
 *
 *   node enrich.mjs [--offline] [--dry-run]
 *
 * The details view has to work on a box with no outbound access, and hitting
 * GitHub per card would burn the 60-requests-an-hour anonymous budget in one
 * page load. So the descriptive data is resolved here, once, and committed
 * alongside the manifest; the UI only ever reads what the seeder already put in
 * the database, and links out for anything deeper.
 *
 * Only the `meta` block is touched — everything else in the file is preserved,
 * including hand-written manifests the Coolify importer never sees.
 */

const args = {
  offline: process.argv.includes('--offline'),
  dryRun: process.argv.includes('--dry-run'),
};

const upstream = loadUpstream(ensureUpstream({ offline: args.offline }));

// `meta` sits at the end of the file, after the deployment fields.
function withMeta(data, meta) {
  const { meta: _drop, ...rest } = data;
  return { ...rest, meta };
}

function clean(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== '' && (!Array.isArray(v) || v.length)),
  );
}

let enriched = 0;
let linkedOnly = 0;
const stats = { license: 0, about: 0, stars: 0, source: 0 };

for (const { file, data } of loadManifests()) {
  const entry = data.upstream && data.upstream !== 'none' ? upstream.get(data.upstream) : null;
  const existing = data.meta ?? {};

  const links = clean({
    // Coolify's documentation link is written by the importer; keep it.
    docs: existing.links?.docs,
    website: entry?.website_url,
    source: entry?.source_code_url,
    demo: entry?.demo_url,
  });

  const meta = clean({
    // The upstream blurb explains what the thing actually does; the card's own
    // description is a one-liner and stays as the summary.
    about: entry?.description,
    license: entry?.licenses?.join(', '),
    // Upstream tags are editorial ("Media Streaming - Multimedia"); Coolify's
    // are keywords. Prefer the keywords, they read better as chips.
    tags: existing.tags?.length ? existing.tags : entry?.tags,
    stars: entry?.stargazers_count,
    updatedAt: entry?.updated_at,
    archived: entry?.archived === true ? true : undefined,
    links,
  });

  if (entry) {
    enriched++;
    if (meta.license) stats.license++;
    if (meta.about) stats.about++;
    if (meta.stars) stats.stars++;
    if (links.source) stats.source++;
  } else if (Object.keys(meta).length) {
    linkedOnly++;
  }

  if (!args.dryRun) {
    writeFileSync(join(APPS_DIR, file), `${JSON.stringify(withMeta(data, meta), null, 2)}\n`);
  }
}

const total = loadManifests().length;
console.log(`${total} manifest(s)${args.dryRun ? ' (dry run)' : ''}`);
console.log(`  matched in awesome-selfhosted: ${enriched}`);
console.log(`  Coolify documentation only:    ${linkedOnly}`);
console.log(
  `  with license ${stats.license}, long description ${stats.about}, ` +
    `stars ${stats.stars}, source link ${stats.source}`,
);
