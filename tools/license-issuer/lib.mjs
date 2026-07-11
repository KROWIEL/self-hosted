import { createPrivateKey, createPublicKey, sign as edSign } from 'node:crypto';

/**
 * Shared helpers for the license issuer. A license key is:
 *   base64url(payloadJson) + "." + base64url(ed25519Signature)
 * matching the verifier in apps/control-plane/src/common/licensing/license.ts.
 */

/** Modules granted automatically by each tier (mirror @selfhosted/shared). */
export const ALL_MODULES = [
  'reverse-tunnels',
  'preview-envs',
  'offsite-backups',
  'alerts',
  'metrics-history',
  'sso',
  'audit-export',
  'api-cli',
  'white-label',
];

export const TIER_MODULES = {
  free: [],
  homelab: ['reverse-tunnels'],
  pro: [...ALL_MODULES],
};

export function base64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sign a license payload with an Ed25519 private key (PEM string).
 * @param {object} payload  LicensePayload (v, tier, modules?, sub?, name?, iat, exp)
 * @param {string} privateKeyPem  PKCS#8 PEM
 * @returns {string} the license key
 */
export function signLicense(payload, privateKeyPem) {
  const key = createPrivateKey(privateKeyPem);
  const json = Buffer.from(JSON.stringify(payload), 'utf8');
  const signature = edSign(null, json, key);
  return `${base64url(json)}.${base64url(signature)}`;
}

/** Derive the SPKI public-key PEM from a PKCS#8 private-key PEM. */
export function publicPemFromPrivate(privateKeyPem) {
  const pub = createPublicKey(createPrivateKey(privateKeyPem));
  return pub.export({ type: 'spki', format: 'pem' });
}
