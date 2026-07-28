#!/usr/bin/env node
import { loadManifests, validateManifest, validationContext } from './lib.mjs';

/**
 * Check every `catalog/apps/*.json` manifest against the shape the seeder and
 * the web UI expect.
 *
 *   node validate.mjs
 *
 * Beyond the plain field checks this cross-references the two things that fail
 * silently at runtime: an `icon` with no glyph renders as a blank box, and a
 * `category` with no i18n key shows the raw English string to Russian users.
 */

const context = validationContext();
const manifests = loadManifests();

let failed = 0;
const slugs = new Map();

for (const manifest of manifests) {
  const errors = validateManifest(manifest, context);

  const previous = slugs.get(manifest.data.slug);
  if (previous) errors.push(`slug is already used by ${previous}`);
  slugs.set(manifest.data.slug, manifest.file);

  if (errors.length > 0) {
    failed++;
    console.error(`✗ ${manifest.file}`);
    for (const error of errors) console.error(`    ${error}`);
  }
}

const categories = new Set(manifests.map((m) => m.data.category));
console.log(
  `${manifests.length} manifest(s), ${categories.size} categories, ${failed} with errors.`,
);

if (failed > 0) process.exit(1);
