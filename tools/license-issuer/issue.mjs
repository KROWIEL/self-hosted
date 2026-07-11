#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TIER_MODULES, signLicense } from './lib.mjs';

/**
 * Issue (sign) a license key.
 *
 *   node issue.mjs --tier pro --email buyer@acme.com --name "Acme Inc" --days 365
 *
 * Flags:
 *   --tier   free | homelab | pro           (required)
 *   --email  customer id / order email      (optional, informational)
 *   --name   customer / org display name     (optional, informational)
 *   --days   validity in days; 0 = perpetual (default 365)
 *   --modules a,b,c  extra à-la-carte modules beyond the tier (optional)
 *   --key    path to the PKCS#8 private key PEM (default keys/private.pem)
 */
const here = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1]?.startsWith('--') ? 'true' : argv[++i];
      out[k] = v ?? 'true';
    }
  }
  return out;
}

const args = parseArgs(process.argv);
const tier = args.tier;
if (!['free', 'homelab', 'pro'].includes(tier)) {
  console.error('Error: --tier must be one of free | homelab | pro');
  process.exit(1);
}

const days = args.days !== undefined ? Number(args.days) : 365;
if (!Number.isFinite(days) || days < 0) {
  console.error('Error: --days must be a non-negative number (0 = perpetual)');
  process.exit(1);
}

const keyPath = args.key
  ? isAbsolute(args.key)
    ? args.key
    : join(process.cwd(), args.key)
  : join(here, 'keys', 'private.pem');

if (!existsSync(keyPath)) {
  console.error(
    `Error: private key not found at ${keyPath}. Run "node keygen.mjs" first ` +
      `or pass --key <path>.`,
  );
  process.exit(1);
}

const now = Math.floor(Date.now() / 1000);
const extraModules = args.modules
  ? args.modules
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean)
  : [];

const payload = {
  v: 1,
  tier,
  iat: now,
  exp: days === 0 ? 0 : now + days * 86400,
};
if (args.email) payload.sub = args.email;
if (args.name) payload.name = args.name;
if (extraModules.length) payload.modules = extraModules;

const privateKeyPem = readFileSync(keyPath, 'utf8');
const licenseKey = signLicense(payload, privateKeyPem);

const grantedModules = Array.from(
  new Set([...(TIER_MODULES[tier] ?? []), ...extraModules]),
);

console.error('Issued license:');
console.error(`  tier    : ${tier}`);
console.error(`  modules : ${grantedModules.join(', ') || '(core only)'}`);
console.error(`  subject : ${payload.sub ?? '-'}`);
console.error(`  name    : ${payload.name ?? '-'}`);
console.error(
  `  expires : ${payload.exp === 0 ? 'never (perpetual)' : new Date(payload.exp * 1000).toISOString()}`,
);
console.error('\nLicense key (send this to the customer):\n');
// The key itself goes to stdout so it can be piped/captured cleanly.
console.log(licenseKey);
