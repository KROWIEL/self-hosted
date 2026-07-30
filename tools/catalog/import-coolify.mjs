#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  APPS_DIR,
  CACHE_DIR,
  ensureUpstream,
  loadManifests,
  loadUpstream,
} from './lib.mjs';

/**
 * Import one-click apps from Coolify's service templates.
 *
 *   node import-coolify.mjs [--offline] [--dry-run] [--prune]
 *
 * Coolify (Apache-2.0) publishes ~334 templates that each carry a working
 * compose document — the deployment data awesome-selfhosted deliberately does
 * not track. That makes it the only source that can grow the catalog without a
 * human writing every port, volume and environment variable by hand.
 *
 * Imported manifests are tagged `"source": "coolify"`. The importer only ever
 * rewrites files carrying that tag, so a hand-written manifest always wins and
 * local fixes to a generated one survive until someone drops the tag.
 */

const TEMPLATES_URL =
  'https://raw.githubusercontent.com/coollabsio/coolify/main/templates/service-templates.json';

// Mirrors services/agent/internal/compose/policy.go. A template tripping any of
// these can never deploy, so importing it would only advertise a broken app.
const AGENT_POLICY = [
  [/(^|[\s,{])privileged\s*:\s*true\b/i, 'privileged: true'],
  [/\/var\/run\/docker\.sock/i, 'mounts the docker socket'],
  [/(^|[\s,{])network_mode\s*:\s*["']?host["']?\b/i, 'network_mode: host'],
];

// Reverse proxies fight our own Traefik; VPNs need host networking or NET_ADMIN.
const SKIP_CATEGORIES = new Set(['proxy', 'vpn', 'networking']);

const CATEGORY_MAP = {
  ai: 'AI',
  analytics: 'Analytics',
  api: 'DevTools',
  auth: 'Security',
  automation: 'Automation',
  backend: 'Backend',
  ci: 'DevTools',
  cms: 'CMS',
  communication: 'Communication',
  database: 'Databases',
  development: 'DevTools',
  devtools: 'DevTools',
  documentation: 'CMS',
  email: 'Communication',
  family: 'Productivity',
  finance: 'Finance',
  games: 'Games',
  git: 'DevTools',
  health: 'Productivity',
  helpdesk: 'Productivity',
  mcp: 'AI',
  media: 'Media',
  messaging: 'Communication',
  monitoring: 'Monitoring',
  productivity: 'Productivity',
  rss: 'Feeds',
  search: 'Search',
  security: 'Security',
  storage: 'Storage',
};

const ICON_BY_CATEGORY = {
  AI: 'ai',
  Analytics: 'chart',
  Automation: 'workflow',
  Backend: 'database',
  CMS: 'globe',
  Communication: 'chat',
  Dashboards: 'dashboard',
  Databases: 'database',
  DevTools: 'code',
  Documents: 'doc',
  Feeds: 'rss',
  Finance: 'wallet',
  Games: 'game',
  Media: 'media',
  Monitoring: 'monitor',
  Productivity: 'note',
  Search: 'search',
  Security: 'lock',
  Storage: 'storage',
};

const SECRET_HINT = /(PASSWORD|PASSWD|SECRET|TOKEN|APIKEY|API_KEY|_KEY|SALT|CREDENTIAL)/i;

function parseArgs(argv) {
  const out = {};
  for (const arg of argv.slice(2)) {
    if (arg === '--offline') out.offline = true;
    else if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--prune') out.prune = true;
    else {
      console.error(`Unknown flag: ${arg}`);
      process.exit(1);
    }
  }
  return out;
}

async function loadTemplates(offline) {
  const path = join(CACHE_DIR, 'coolify.json');
  if (!offline) {
    const res = await fetch(TEMPLATES_URL);
    if (!res.ok) throw new Error(`Coolify templates: HTTP ${res.status}`);
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(path, await res.text());
  }
  if (!existsSync(path)) {
    throw new Error(`No cached templates at ${path}; run without --offline first`);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

// Coolify keys are mostly kebab-case already, but a few are camelCase.
function kebab(key) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function titleCase(slug) {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Rewrite Coolify's generated-value placeholders into plain compose variables
 * and report what each one should become in `envDefaults`.
 *
 * `SERVICE_PASSWORD_MYSQL` → `${MYSQL_PASSWORD}` declared as a required secret;
 * `SERVICE_USER_MYSQL` → `${MYSQL_USER}` with a sane default; a bare
 * `SERVICE_FQDN_APP_3000` line declares the public port and is dropped, since
 * routing is Traefik's job here rather than something the stack configures.
 */
function convertMagic(yaml) {
  const env = new Map();
  const declare = (key, spec) => {
    if (!env.has(key)) env.set(key, { key, ...spec });
  };

  let port = null;
  const lines = [];

  // A placeholder standing alone on a line only *declares* a generated value —
  // written either as a list entry or as a mapping key. Every consumer spells it
  // with a leading `$`, and those references are rewritten below, so the
  // declarations themselves can go. An FQDN one also names the public port.
  const BARE =
    /^\s*(?:-\s+)?['"]?SERVICE_(FQDN|URL|PASSWORD|USER|BASE64|REALBASE64|HEX)[A-Z0-9_]*?(?:_(\d+))?['"]?\s*:?\s*$/;

  for (const line of yaml.split('\n')) {
    const bare = BARE.exec(line);
    if (bare) {
      if (bare[2] && (bare[1] === 'FQDN' || bare[1] === 'URL')) port = Number(bare[2]);
      continue;
    }
    lines.push(line);
  }
  let out = lines.join('\n');

  const suffixed = (name, suffix) =>
    /(PASSWORD|SECRET|KEY|TOKEN)$/.test(name) ? name : `${name}_${suffix}`;

  const named = (kind, name) => {
    if (kind === 'FQDN' || kind === 'URL') {
      declare('APP_URL', { required: true });
      return '${APP_URL}';
    }
    if (kind === 'USER') {
      const key = suffixed(name, 'USER');
      declare(key, { value: name.toLowerCase() });
      return `\${${key}}`;
    }
    // Coolify generates these, so the stack genuinely cannot start without one.
    const key = suffixed(name, kind === 'PASSWORD' ? 'PASSWORD' : 'SECRET');
    declare(key, { secret: true, required: true });
    return `\${${key}}`;
  };

  const KINDS = 'FQDN|URL|PASSWORD|USER|BASE64|REALBASE64|HEX';

  // $SERVICE_KIND[_<length>]_<NAME>, optionally wrapped in ${...}.
  out = out.replace(
    // The name has to start with a letter, or `$SERVICE_REALBASE64_128` would
    // read its length as the name and yield a variable called `128_SECRET`.
    new RegExp(`\\$\\{?SERVICE_(${KINDS})(?:_(\\d+))?_([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)\\}?`, 'g'),
    (_m, kind, _len, name) => named(kind, name),
  );

  // The same placeholders without a name: `$SERVICE_PASSWORD`,
  // `$SERVICE_REALBASE64_128`. Coolify still generates a value; we just have to
  // invent the variable name ourselves.
  out = out.replace(
    new RegExp(`\\$\\{?SERVICE_(${KINDS})(?:_\\d+)?\\}?(?![A-Z0-9_])`, 'g'),
    (_m, kind) => named(kind, 'APP'),
  );

  // An unresolved *reference* means a placeholder shape we do not understand.
  // Bare occurrences are not interesting: declarations were stripped above, and
  // names like `GRIST_TERMS_OF_SERVICE_FQDN` merely contain the same substring.
  const leftover = out.match(new RegExp(`\\$\\{?SERVICE_(${KINDS})\\w*`, 'g'));

  // Ordinary compose interpolation becomes the user-facing form. A variable with
  // no fallback is optional rather than required: compose would have substituted
  // an empty string, and demanding every one of Langfuse's S3 settings up front
  // would make an otherwise one-click install unusable.
  for (const m of out.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::?-([^}]*))?\}/g)) {
    const [, key, fallback] = m;
    if (fallback !== undefined) declare(key, { value: fallback });
    else if (SECRET_HINT.test(key)) declare(key, { secret: true });
    else declare(key, { value: '' });
  }

  return { yaml: out, env: [...env.values()], port, leftover };
}

const args = parseArgs(process.argv);
const templates = await loadTemplates(args.offline);
const upstream = loadUpstream(ensureUpstream({ offline: true }));

const existing = new Map(loadManifests().map((m) => [m.data.slug, m.data]));

/**
 * Coolify ships the same app several times over, once per database backend —
 * `gitea-with-mysql`, `gitea-with-postgresql` and so on, 48 entries in all.
 * Listing every one of them would bury the catalog in near-duplicates, so keep
 * the plain app where it exists and otherwise a single preferred variant.
 */
const VARIANT = /^(.+?)-with(?:out)?-(.+)$/;
const BACKEND_RANK = ['postgresql', 'postgres', 'mariadb', 'mysql', 'sqlite'];

function chooseVariants(slugs) {
  const all = new Set([...slugs, ...existing.keys()]);
  const groups = new Map();
  for (const slug of slugs) {
    const m = VARIANT.exec(slug);
    if (!m) continue;
    (groups.get(m[1]) ?? groups.set(m[1], []).get(m[1])).push(slug);
  }
  const rejected = new Map();
  for (const [base, variants] of groups) {
    let winner = null;
    if (!all.has(base)) {
      winner = [...variants].sort((a, b) => {
        const rank = (s) => {
          const i = BACKEND_RANK.indexOf(VARIANT.exec(s)[2]);
          return i === -1 ? BACKEND_RANK.length : i;
        };
        return rank(a) - rank(b) || a.localeCompare(b);
      })[0];
    }
    for (const v of variants) {
      if (v !== winner) rejected.set(v, base);
    }
  }
  return rejected;
}

const duplicateVariants = chooseVariants(Object.keys(templates).map(kebab));

// Slug spelling differs between catalogues — we ship `wiki-js` and `actual`
// where Coolify has `wikijs` and `actualbudget`. Comparing without separators
// stops the same app appearing twice under two names.
// We ship `wiki-js` and `actual` where Coolify has `wikijs` and `actualbudget`,
// so compare without separators and against our display name too ("Actual
// Budget" is the same app). Otherwise it lands in the catalog twice.
const loose = (s) => s.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
const handWritten = new Map();
for (const [slug, data] of existing) {
  if (data.source === 'coolify') continue;
  handWritten.set(loose(slug), slug);
  handWritten.set(loose(data.name), slug);
}
const stats = { written: 0, skipped: {}, kept: 0 };
const skip = (slug, reason) => {
  (stats.skipped[reason] ??= []).push(slug);
};

const imported = new Set();

for (const [key, template] of Object.entries(templates)) {
  const slug = kebab(key);
  const current = existing.get(slug);
  if (current && current.source !== 'coolify') {
    stats.kept++;
    continue;
  }

  const covered = handWritten.get(loose(slug));
  if (covered && covered !== slug) {
    stats.kept++;
    continue;
  }

  if (duplicateVariants.has(slug)) {
    skip(slug, `duplicate backend variant of "${duplicateVariants.get(slug)}"`);
    continue;
  }

  // A handful of entries carry a comma-joined list; the first one wins.
  const declared = String(template.category ?? '').toLowerCase().split(',')[0].trim();
  if (SKIP_CATEGORIES.has(declared)) {
    skip(slug, 'category is incompatible with the platform');
    continue;
  }
  const category = CATEGORY_MAP[declared];
  if (!category) {
    skip(slug, `unmapped category "${template.category}"`);
    continue;
  }

  const raw = Buffer.from(template.compose, 'base64').toString('utf8');
  const violation = AGENT_POLICY.find(([re]) => re.test(raw));
  if (violation) {
    skip(slug, `agent compose policy: ${violation[1]}`);
    continue;
  }

  // Upstream occasionally normalises an environment list into a mapping keyed by
  // list index, which would set variables literally named "0", "1", "2".
  if (/^\s+\d+:\s/m.test(raw)) {
    skip(slug, 'upstream template has numeric environment keys');
    continue;
  }

  const { yaml, env, port, leftover } = convertMagic(raw);
  if (leftover) {
    skip(slug, `unrecognised Coolify placeholder (${[...new Set(leftover)].join(' ')})`);
    continue;
  }

  // Our validator insists on an explicit tag; Coolify often leaves it implicit.
  const composeYaml = yaml.replace(
    /^(\s*image:\s*)(['"]?)([^'"\s:]+(?:\/[^'"\s:]+)*)(\2)\s*$/gm,
    (_m, head, quote, image) => `${head}${quote}${image}:latest${quote}`,
  );

  const usable = (p) => Number.isInteger(p) && p > 0 && p <= 65535;
  const declaredPort = Number(template.port);
  const defaultPort = usable(declaredPort) ? declaredPort : port;
  if (!usable(defaultPort)) {
    skip(slug, 'no usable port declared');
    continue;
  }

  const listed = upstream.get(slug);
  const tags = String(template.tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  // `enrich.mjs` fills the rest of `meta` from awesome-selfhosted; keep whatever
  // it wrote so the two scripts can run in either order.
  const meta = {
    ...(current?.meta ?? {}),
    ...(tags.length ? { tags } : {}),
    links: {
      ...(current?.meta?.links ?? {}),
      ...(template.documentation ? { docs: template.documentation.split('?')[0] } : {}),
    },
  };

  const manifest = {
    slug,
    name: listed?.name ?? titleCase(slug),
    description: template.slogan?.trim() || `${titleCase(slug)}, self-hosted.`,
    category,
    icon: ICON_BY_CATEGORY[category] ?? 'storage',
    upstream: listed ? slug : 'none',
    source: 'coolify',
    deployKind: 'compose',
    composeFile: 'docker-compose.yml',
    composeYaml,
    defaultPort,
    recommendedVolumes: [],
    envDefaults: env,
    meta,
  };

  imported.add(slug);
  if (!args.dryRun) {
    writeFileSync(join(APPS_DIR, `${slug}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
  }
  stats.written++;
}

// Templates Coolify has dropped since the last run.
if (args.prune) {
  for (const [slug, data] of existing) {
    if (data.source === 'coolify' && !imported.has(slug)) {
      if (!args.dryRun) unlinkSync(join(APPS_DIR, `${slug}.json`));
      skip(slug, 'no longer published by Coolify (removed)');
    }
  }
}

console.log(`Coolify templates: ${Object.keys(templates).length}`);
console.log(`  imported:            ${stats.written}${args.dryRun ? ' (dry run)' : ''}`);
console.log(`  hand-written, kept:  ${stats.kept}`);
for (const [reason, slugs] of Object.entries(stats.skipped).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  skipped ${String(slugs.length).padStart(3)} — ${reason}`);
  console.log(`      ${slugs.join(', ')}`);
}
