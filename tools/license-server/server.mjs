// Reference online-activation server (SELLER-SIDE ONLY).
//
// The panel POSTs { key, instanceId, product, version } here on a heartbeat.
// We verify the key's Ed25519 signature (with the PUBLIC key), check expiry,
// a revocation list, and a per-key seat limit, then reply:
//   { ok: true, tier, exp }              — activated
//   { ok: false, reason: "..." }         — denied (revoked/expired/seat_limit)
//
// Deploy this behind HTTPS and point the panel's LICENSE_ACTIVATION_URL at it.
// It uses only Node built-ins (no dependencies) and a JSON file for state.
//
// Env:
//   PORT                (default 8787)
//   LICENSE_PUBLIC_KEY  full PEM, or omit to read ../license-issuer/keys/public.pem
//   DEFAULT_SEATS       max activations per key when the key has no `seats` (default 3)
//   STATE_FILE          path to the JSON seat/state store (default ./state.json)
//   REVOKED_FILE        path to a JSON array of revoked subjects (default ./revoked.json)

import { createServer } from 'node:http';
import { createPublicKey, verify as edVerify } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8787;
const DEFAULT_SEATS = Number(process.env.DEFAULT_SEATS) || 3;
const STATE_FILE = process.env.STATE_FILE || resolve(__dir, 'state.json');
const REVOKED_FILE = process.env.REVOKED_FILE || resolve(__dir, 'revoked.json');

function publicKeyPem() {
  const env = process.env.LICENSE_PUBLIC_KEY;
  if (env && env.trim()) return env.includes('BEGIN') ? env.replace(/\\n/g, '\n') : env;
  return readFileSync(resolve(__dir, '../license-issuer/keys/public.pem'), 'utf8');
}
const PUBLIC_KEY = createPublicKey(publicKeyPem());

function b64urlToBuf(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function verifyKey(key) {
  try {
    const dot = key.indexOf('.');
    if (dot <= 0) return null;
    const payloadBuf = b64urlToBuf(key.slice(0, dot));
    const sig = b64urlToBuf(key.slice(dot + 1));
    if (!edVerify(null, payloadBuf, PUBLIC_KEY, sig)) return null;
    return JSON.parse(payloadBuf.toString('utf8'));
  } catch {
    return null;
  }
}

function loadJson(file, fallback) {
  try {
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : fallback;
  } catch {
    return fallback;
  }
}

function activate({ key, instanceId }) {
  if (!key || !instanceId) return { ok: false, reason: 'bad_request' };
  const payload = verifyKey(String(key));
  if (!payload) return { ok: false, reason: 'rejected' };

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp > 0 && payload.exp < now) {
    return { ok: false, reason: 'expired' };
  }

  const revoked = loadJson(REVOKED_FILE, []);
  if (payload.sub && Array.isArray(revoked) && revoked.includes(payload.sub)) {
    return { ok: false, reason: 'revoked' };
  }

  // Seat limiting: keyed by the license `sub` (customer/order id).
  const seatKey = payload.sub || key.slice(0, 24);
  const limit = Number(payload.seats) > 0 ? Number(payload.seats) : DEFAULT_SEATS;
  const state = loadJson(STATE_FILE, {});
  const seats = state[seatKey] || {};
  if (!seats[instanceId] && Object.keys(seats).length >= limit) {
    return { ok: false, reason: 'seat_limit' };
  }
  seats[instanceId] = { lastSeen: now, version: undefined };
  state[seatKey] = seats;
  try {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {
    /* best-effort persistence */
  }

  return { ok: true, tier: payload.tier, exp: payload.exp ?? 0 };
}

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"ok":true}');
    return;
  }
  if (req.method !== 'POST' || !req.url.startsWith('/activate')) {
    res.writeHead(404).end();
    return;
  }
  let body = '';
  req.on('data', (c) => {
    body += c;
    if (body.length > 64_000) req.destroy();
  });
  req.on('end', () => {
    let json;
    try {
      json = JSON.parse(body || '{}');
    } catch {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end('{"ok":false,"reason":"bad_json"}');
      return;
    }
    const result = activate(json);
    res.writeHead(result.ok ? 200 : 403, { 'content-type': 'application/json' });
    res.end(JSON.stringify(result));
  });
});

server.listen(PORT, () => {
  console.log(`license-server listening on :${PORT} (seats/key default: ${DEFAULT_SEATS})`);
});
