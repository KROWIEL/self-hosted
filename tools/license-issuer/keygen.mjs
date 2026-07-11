#!/usr/bin/env node
import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Generate an Ed25519 signing keypair for issuing license keys.
 *
 *   node keygen.mjs [--force]
 *
 * Writes keys/private.pem (KEEP SECRET) and keys/public.pem, and prints the
 * public key to embed as DEFAULT_PUBLIC_KEY_PEM in the control-plane verifier
 * (or ship via the LICENSE_PUBLIC_KEY env var).
 */
const here = dirname(fileURLToPath(import.meta.url));
const keysDir = join(here, 'keys');
const privPath = join(keysDir, 'private.pem');
const pubPath = join(keysDir, 'public.pem');
const force = process.argv.includes('--force');

if (existsSync(privPath) && !force) {
  console.error(
    `Refusing to overwrite existing ${privPath}. Pass --force to regenerate ` +
      `(this invalidates every key signed with the old private key).`,
  );
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const privPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const pubPem = publicKey.export({ type: 'spki', format: 'pem' });

mkdirSync(keysDir, { recursive: true });
writeFileSync(privPath, privPem, { mode: 0o600 });
writeFileSync(pubPath, pubPem);

console.log(`Wrote ${privPath} (keep this secret!)`);
console.log(`Wrote ${pubPath}`);
console.log('\nEmbed this public key in the control-plane verifier:\n');
process.stdout.write(pubPem);
