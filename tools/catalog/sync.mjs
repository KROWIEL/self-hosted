#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
import {
  ACTIVITY_WINDOW_MONTHS,
  ensureUpstream,
  isBehind,
  loadManifests,
  loadUpstream,
  pinnedVersion,
  recentCommits,
  versionParts,
} from './lib.mjs';

/**
 * Compare `catalog/apps/*.json` against awesome-selfhosted-data and print a
 * report: which apps we ship have gone stale upstream, and which popular
 * self-hostable projects we do not ship yet.
 *
 *   node sync.mjs [--candidates 30] [--offline] [--json] [--out FILE]
 *
 * This deliberately does not write manifests. Upstream tracks projects, not
 * deployments: it has no image name, port, volume or environment data, so a
 * generated manifest would be a guess. The report is the input to a human
 * adding one.
 */

function parseArgs(argv) {
  const out = { candidates: 25 };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--offline') out.offline = true;
    else if (arg === '--json') out.json = true;
    else if (arg === '--candidates') out.candidates = Number(argv[++i]);
    else if (arg === '--out') out.out = argv[++i];
    else {
      console.error(`Unknown flag: ${arg}`);
      process.exit(1);
    }
  }
  if (!Number.isFinite(out.candidates) || out.candidates < 0) {
    console.error('Error: --candidates must be a non-negative number');
    process.exit(1);
  }
  return out;
}

const args = parseArgs(process.argv);

const upstream = loadUpstream(ensureUpstream({ offline: args.offline }));
const manifests = loadManifests();

// ------------------------------------------------------------------ tracked

const tracked = [];
for (const { file, data } of manifests) {
  if (data.upstream === 'none') continue;
  const entry = upstream.get(data.upstream);
  if (!entry) {
    tracked.push({
      slug: data.slug,
      file,
      upstream: data.upstream,
      issues: ['missing from awesome-selfhosted (renamed, or delisted)'],
    });
    continue;
  }

  const issues = [];
  if (entry.archived) issues.push('upstream repository is archived');
  const commits = recentCommits(entry);
  if (commits === 0) {
    issues.push(`no commits in the last ${ACTIVITY_WINDOW_MONTHS} months`);
  }

  const latestRelease = entry.current_release?.tag ?? null;
  tracked.push({
    slug: data.slug,
    file,
    upstream: entry.id,
    stars: entry.stargazers_count ?? 0,
    commits,
    latestRelease,
    pinned: data.image ?? null,
    behind: isBehind(pinnedVersion(data.image), versionParts(latestRelease)),
    issues,
  });
}

const flagged = tracked.filter((app) => app.issues.length > 0);

// --------------------------------------------------------------- candidates

// `platforms` is informational upstream — plenty of entries with official
// images never list Docker — so it annotates candidates rather than filtering
// them out.
const shipped = new Set(manifests.map((m) => m.data.upstream));
const candidates = [...upstream.values()]
  .filter((entry) => !shipped.has(entry.id) && !entry.archived && recentCommits(entry) > 0)
  .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
  .slice(0, args.candidates)
  .map((entry) => ({
    id: entry.id,
    name: entry.name,
    stars: entry.stargazers_count ?? 0,
    tags: entry.tags ?? [],
    platforms: entry.platforms ?? [],
    licenses: entry.licenses ?? [],
    description: entry.description ?? '',
    sourceUrl: entry.source_code_url ?? entry.website_url ?? '',
  }));

// ------------------------------------------------------------------- report

if (args.json) {
  const json = JSON.stringify({ tracked, candidates }, null, 2);
  if (args.out) writeFileSync(args.out, json);
  else console.log(json);
  process.exit(0);
}

const lines = [];
lines.push(`Catalog sync — ${manifests.length} apps shipped, ${upstream.size} upstream entries`);
lines.push('');

lines.push(`## Needs attention (${flagged.length})`);
lines.push('');
if (flagged.length === 0) {
  lines.push('Nothing flagged: every tracked app is still active upstream.');
} else {
  for (const app of flagged) {
    lines.push(`- **${app.slug}** — ${app.issues.join('; ')}`);
  }
}
lines.push('');

const behind = tracked.filter((app) => app.behind);
lines.push(`## Pinned version behind upstream (${behind.length})`);
lines.push('');
lines.push('Only apps pinned to an explicit version; floating tags are skipped.');
lines.push('');
for (const app of behind) {
  lines.push(`- \`${app.slug}\` pins \`${app.pinned}\`, upstream released \`${app.latestRelease}\``);
}
lines.push('');

lines.push(`## Candidates not in the catalog (top ${candidates.length})`);
lines.push('');
for (const c of candidates) {
  lines.push(
    `- **${c.name}** (${c.stars.toLocaleString('en-US')}★, ${c.licenses.join('/') || 'unknown licence'}) — ${c.description}`,
  );
  lines.push(
    `  <${c.sourceUrl}> · ${c.tags.join(', ')} · ${c.platforms.join(', ') || 'platforms unlisted'} · id \`${c.id}\``,
  );
}

const report = `${lines.join('\n')}\n`;
if (args.out) writeFileSync(args.out, report);
else process.stdout.write(report);

// A stale entry is worth a red build; new candidates are not.
if (flagged.length > 0) process.exitCode = 1;
