#!/usr/bin/env node
import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIER_MODULES, signLicense } from './lib.mjs';

/**
 * EXAMPLE seller-side webhook receiver (Lemon Squeezy / Polar style).
 *
 * This runs on YOUR infrastructure — never inside a customer's panel. On a paid
 * order it verifies the store's HMAC signature, maps the purchased product/variant
 * to a tier, signs a license key, and (here) returns it. In production you would
 * email the key to the buyer and persist the order → key mapping.
 *
 *   LICENSE_PRIVATE_KEY_PATH=keys/private.pem \
 *   STORE_WEBHOOK_SECRET=whsec_xxx \
 *   node webhook-example.mjs
 *
 * Then point your store's webhook at http://<host>:8787/webhook.
 */
const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8787);
const SECRET = process.env.STORE_WEBHOOK_SECRET ?? '';
const KEY_PATH =
  process.env.LICENSE_PRIVATE_KEY_PATH ?? join(here, 'keys', 'private.pem');
const privateKeyPem = readFileSync(KEY_PATH, 'utf8');

// Map your store's product/variant identifiers to a tier. Adjust to your catalog.
const VARIANT_TIER = {
  'home-lab': 'homelab',
  pro: 'pro',
};

function verifySignature(rawBody, signatureHeader) {
  if (!SECRET) return true; // dev mode: skip verification
  if (!signatureHeader) return false;
  const digest = createHmac('sha256', SECRET).update(rawBody).digest('hex');
  const a = Buffer.from(digest);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}

function issueForOrder(order) {
  const variant = String(order.variant ?? order.product ?? '').toLowerCase();
  const tier = VARIANT_TIER[variant] ?? 'homelab';
  const now = Math.floor(Date.now() / 1000);
  const days = Number(order.days ?? 365);
  const payload = {
    v: 1,
    tier,
    iat: now,
    exp: days === 0 ? 0 : now + days * 86400,
    sub: order.email,
    name: order.name,
  };
  const key = signLicense(payload, privateKeyPem);
  return { tier, modules: TIER_MODULES[tier], key };
}

const server = createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404).end('not found');
    return;
  }
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const sig = req.headers['x-signature'] || req.headers['x-webhook-signature'];
    if (!verifySignature(raw, Array.isArray(sig) ? sig[0] : sig)) {
      res.writeHead(401).end('bad signature');
      return;
    }
    let order;
    try {
      const body = JSON.parse(raw || '{}');
      // Normalize a couple of common store payload shapes.
      order = body.order ?? body.data?.attributes ?? body;
    } catch {
      res.writeHead(400).end('bad json');
      return;
    }
    const result = issueForOrder(order);
    // TODO: email result.key to order.email and store the mapping.
    console.log(`Issued ${result.tier} license for ${order.email ?? 'unknown'}`);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(result));
  });
});

server.listen(PORT, () => {
  console.log(`License webhook example listening on http://localhost:${PORT}/webhook`);
  if (!SECRET) console.log('WARNING: STORE_WEBHOOK_SECRET unset — signature checks disabled (dev only).');
});
