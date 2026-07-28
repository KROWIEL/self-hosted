#!/usr/bin/env node
import { loadManifests, manifestImages } from './lib.mjs';

/**
 * Resolve every image a manifest pulls — including the ones buried in compose
 * documents — against its registry, so a typo or a deleted tag surfaces here
 * rather than in a user's first deploy.
 *
 *   node check-images.mjs [--concurrency 3]
 *
 * Anonymous pulls only: it follows the registry's Bearer challenge and asks for
 * a pull-scoped token, which every public registry we reference hands out
 * without credentials.
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

async function bearerToken(challenge) {
  const params = Object.fromEntries(
    [...challenge.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]),
  );
  if (!params.realm) return null;
  const url = new URL(params.realm);
  if (params.service) url.searchParams.set('service', params.service);
  if (params.scope) url.searchParams.set('scope', params.scope);
  const res = await fetch(url);
  if (!res.ok) return null;
  const body = await res.json();
  return body.token ?? body.access_token ?? null;
}

async function resolveOnce(ref) {
  const { host, repo, tag } = parseRef(ref);
  const url = `https://${host}/v2/${repo}/manifests/${encodeURIComponent(tag)}`;

  let res = await fetch(url, { method: 'HEAD', headers: { accept: ACCEPT } });
  if (res.status === 401) {
    const token = await bearerToken(res.headers.get('www-authenticate') ?? '');
    if (!token) return { ok: false, detail: 'registry refused an anonymous token' };
    res = await fetch(url, {
      method: 'HEAD',
      headers: { accept: ACCEPT, authorization: `Bearer ${token}` },
    });
  }
  if (res.ok) return { ok: true };
  // 429 and 5xx say nothing about whether the tag exists, so let them retry.
  const retryable = res.status === 429 || res.status >= 500;
  return { ok: false, retryable, detail: `HTTP ${res.status}` };
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
      last = { ok: false, retryable: true, detail: e.message };
    }
    if (last.ok || !last.retryable) return last;
    if (attempt < attempts) await sleep(500 * 2 ** attempt);
  }
  return last;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

const concurrencyFlag = process.argv.indexOf('--concurrency');
const concurrency = concurrencyFlag === -1 ? 3 : Number(process.argv[concurrencyFlag + 1]);

const refs = [];
for (const { data } of loadManifests()) {
  for (const image of manifestImages(data)) {
    refs.push({ slug: data.slug, image });
  }
}

const checked = await mapLimit(refs, concurrency, async (ref) => ({
  ...ref,
  ...(await resolve(ref.image)),
}));

const broken = checked.filter((r) => !r.ok);
for (const r of broken) console.error(`✗ ${r.slug}: ${r.image} — ${r.detail}`);
console.log(`Checked ${checked.length} image reference(s), ${broken.length} unresolved.`);

if (broken.length > 0) process.exit(1);
