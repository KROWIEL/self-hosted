# License issuer (seller-side)

Signs commercial license keys for the Self-Hosted PaaS panel. **This tool runs
on your machine / server only — never inside a customer's installation.** The
panel verifies keys offline with the matching public key baked into the
control-plane, so licensing works even on air-gapped / home-lab installs.

## How licensing works

- A license key is `base64url(payloadJson).base64url(ed25519Signature)`.
- The payload declares a `tier` (`free` | `homelab` | `pro`), optional extra
  `modules`, a subject/name, and an expiry (`exp: 0` = perpetual).
- The panel resolves **entitlements** from the key: tier modules ∪ extra modules.
  No valid key ⇒ the generous **Free** core.
- Tiers → modules:
  - `free` → core only
  - `homelab` → `reverse-tunnels`
  - `pro` → all modules

## 1. Generate a signing keypair (once)

```bash
cd tools/license-issuer
node keygen.mjs
```

This writes `keys/private.pem` (**keep secret!**) and `keys/public.pem`, and
prints the public key. Put the public key into the control-plane verifier at
`apps/control-plane/src/common/licensing/license.ts`
(`DEFAULT_PUBLIC_KEY_PEM`), or ship it per-deployment via the
`LICENSE_PUBLIC_KEY` env var. Regenerating the keypair invalidates every
previously issued key.

> A development keypair already ships in `keys/` and matches the default public
> key embedded in the control-plane, so you can issue and activate test keys
> immediately. **Generate a fresh keypair before going to production.**

## 2. Issue a key

```bash
# Perpetual Pro license
node issue.mjs --tier pro --email buyer@acme.com --name "Acme Inc" --days 0

# 1-year Home-Lab license
node issue.mjs --tier homelab --email homelab@user.dev --days 365
```

The license key is printed to stdout (metadata goes to stderr), so you can pipe
it: `node issue.mjs --tier pro --days 0 > buyer.key`.

The customer pastes the key into **Billing → License key** in their panel (admin
only), or you set it via the `LICENSE_KEY` env var for immutable deployments.

## 3. Automate with a store webhook

Sell through a merchant-of-record (Lemon Squeezy, Polar, Paddle) or a one-time
store (Gumroad, CodeCanyon). On a paid order, your webhook signs a key and
emails it to the buyer. See `webhook-example.mjs` for a minimal, store-agnostic
receiver (HMAC signature check + tier mapping + key issue).

```bash
STORE_WEBHOOK_SECRET=whsec_xxx node webhook-example.mjs
# point your store's webhook at http://<host>:8787/webhook
```

## Security notes

- The private key is the crown jewel — store it in a secret manager / vault,
  never in git (`keys/private.pem` is gitignored).
- Rotating the keypair invalidates all existing keys; plan re-issuance.
- Keys are not revocable offline. For revocation, add an optional online check
  (heartbeat endpoint) — the current model is deliberately offline-first.
