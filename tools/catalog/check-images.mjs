#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE_DIR, loadManifests, manifestImages } from './lib.mjs';

/**
 * Resolve every image a manifest pulls — including the ones buried in compose
 * documents — against its registry, so a typo or a deleted tag surfaces here
 * rather than in a user's first deploy.
 *
 *   node check-images.mjs [--concurrency 8] [--no-cache] [--cache-days 7]
 *
 * Anonymous pulls only: it follows the registry's Bearer challenge and asks for
 * a pull-scoped token, which every public registry we reference hands out
 * without credentials. Manifest HEAD requests do not count against Docker Hub's
 * pull limit, so this stays within the anonymous budget.
 */

const ACCEPT = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.docker.distribution.manifest.v2+json',
].join(', ');

function parseRef(ref) {
  const [name, tag = 'latest'] = ref.split('@')[0].split(':');
  const parts = name.split('/');
  const hasRegistry =
    parts.length > 1 && (parts[0].includes('.') || parts[0].includes(':') || parts[0] === 'localhost');

  let host = hasRegistry ? parts.shift() : 'docker.io';
  let repo = parts.join('/');
  if (host === 'docker.io' || host === 'index.docker.io') {
    host = 'registry-1.docker.io';
    if (!repo.includes('/')) repo = `library/${repo}`;
  }
  return { host, repo, tag };
}

// A registry challenges identically for every repository it holds, so the realm
// learnt from the first 401 lets later lookups ask for a token up front and skip
// a guaranteed round-trip. Tokens themselves are scoped per repository.
const realms = new Map();
const tokens = new Map();

function parseChallenge(header) {
  return Object.fromEntries([...header.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
}

async function fetchToken(realm, service, scope) {
  const url = new URL(realm);
  if (service) url.searchParams.set('service', service);
  if (scope) url.searchParams.set('scope', scope);
  const res = await fetch(url);
  if (!res.ok) return null;
  const body = await res.json();
  return body.token ?? body.access_token ?? null;
}

async function tokenFor(host, repo) {
  const key = `${host}|${repo}`;
  if (tokens.has(key)) return tokens.get(key);
  const realm = realms.get(host);
  if (!realm) return null;
  const token = await fetchToken(realm.realm, realm.service, `repository:${repo}:pull`);
  tokens.set(key, token);
  return token;
}

async function resolveOnce(ref) {
  if (ref.includes('${')) {
    return { ok: false, detail: 'tag depends on a variable with no default' };
  }

  const { host, repo, tag } = parseRef(ref);
  const url = `https://${host}/v2/${repo}/manifests/${encodeURIComponent(tag)}`;
  const headers = { accept: ACCEPT };

  const known = await tokenFor(host, repo);
  if (known) headers.authorization = `Bearer ${known}`;

  let res = await fetch(url, { method: 'HEAD', headers });
  if (res.status === 401) {
    const challenge = parseChallenge(res.headers.get('www-authenticate') ?? '');
    if (!challenge.realm) {
      return { ok: false, unverified: true, detail: 'registry refused an anonymous token' };
    }
    realms.set(host, { realm: challenge.realm, service: challenge.service });
    const token = await fetchToken(
      challenge.realm,
      challenge.service,
      challenge.scope ?? `repository:${repo}:pull`,
    );
    if (!token) {
      return { ok: false, unverified: true, detail: 'registry refused an anonymous token' };
    }
    tokens.set(`${host}|${repo}`, token);
    res = await fetch(url, { method: 'HEAD', headers: { ...headers, authorization: `Bearer ${token}` } });
  }

  if (res.ok) return { ok: true };
  // 429 and 5xx say nothing about whether the tag exists, so let them retry.
  const retryable = res.status === 429 || res.status >= 500;
  // A private or credential-walled registry is not a broken reference.
  const unverified = res.status === 401 || res.status === 403 || retryable;
  return { ok: false, retryable, unverified, detail: `HTTP ${res.status}` };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Registries throttle anonymous traffic aggressively and drop connections
 * under load; without a retry a green catalog goes red at random.
 */
async function resolve(ref, attempts = 4) {
  let last;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      last = await resolveOnce(ref);
    } catch (e) {
      last = { ok: false, retryable: true, unverified: true, detail: e.message };
    }
    if (last.ok || !last.retryable) return last;
    if (attempt < attempts) await sleep(500 * 2 ** attempt);
  }
  return last;
}

/**
 * Rate limits are enforced per registry, so a queue per host keeps a slow Docker
 * Hub lookup from holding up the handful of ghcr.io ones behind it.
 */
async function byHost(images, limit, fn) {
  const queues = new Map();
  for (const image of images) {
    const { host } = parseRef(image);
    (queues.get(host) ?? queues.set(host, []).get(host)).push(image);
  }
  const results = new Map();
  await Promise.all(
    [...queues.values()].map(async (queue) => {
      let next = 0;
      await Promise.all(
        Array.from({ length: Math.min(limit, queue.length) }, async () => {
          while (next < queue.length) {
            const image = queue[next++];
            results.set(image, await fn(image));
          }
        }),
      );
    }),
  );
  return results;
}

function flag(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
}

const concurrency = flag('concurrency', 8);
const cacheDays = flag('cache-days', 7);
const useCache = !process.argv.includes('--no-cache');
const cacheFile = join(CACHE_DIR, 'image-results.json');

const cache = new Map();
if (useCache && existsSync(cacheFile)) {
  const cutoff = Date.now() - cacheDays * 86_400_000;
  for (const [ref, entry] of Object.entries(JSON.parse(readFileSync(cacheFile, 'utf8')))) {
    // Only successes are worth remembering: a failure is usually the registry
    // having a bad day, and re-checking it is the whole point of the run.
    if (entry.ok && entry.checkedAt > cutoff) cache.set(ref, entry);
  }
}

const refs = [];
for (const { data } of loadManifests()) {
  for (const image of manifestImages(data)) refs.push({ slug: data.slug, image });
}

// `postgres:16-alpine` alone appears in 28 manifests; resolving it once is both
// faster and politer to the registry.
const unique = [...new Set(refs.map((r) => r.image))];
const pending = unique.filter((image) => !cache.has(image));

const started = Date.now();
const fresh = await byHost(pending, concurrency, resolve);
const results = new Map([...cache, ...fresh]);

if (useCache) {
  mkdirSync(CACHE_DIR, { recursive: true });
  const store = {};
  for (const [ref, result] of results) {
    if (result.ok) store[ref] = { ok: true, checkedAt: Date.now() };
  }
  writeFileSync(cacheFile, JSON.stringify(store, null, 2));
}

const checked = refs.map((r) => ({ ...r, ...results.get(r.image) }));
const missing = checked.filter((r) => !r.ok && !r.unverified);
const unverified = checked.filter((r) => !r.ok && r.unverified);

for (const r of missing) console.error(`✗ ${r.slug}: ${r.image} — ${r.detail}`);
for (const r of unverified) console.warn(`? ${r.slug}: ${r.image} — ${r.detail}`);

console.log(
  `Checked ${checked.length} reference(s) — ${unique.length} unique, ` +
    `${cache.size} from cache, ${pending.length} resolved in ${((Date.now() - started) / 1000).toFixed(1)}s.`,
);
console.log(
  `  ${checked.length - missing.length - unverified.length} ok, ` +
    `${missing.length} missing, ${unverified.length} unverifiable anonymously.`,
);

// Only a reference we positively know is wrong should fail the run; a registry
// that hides behind credentials or rate-limits us proves nothing either way.
if (missing.length > 0) process.exit(1);
