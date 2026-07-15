# Licensing & monetization

This panel is **open-core**: a generous free core drives adoption, and paid tiers
unlock add-on modules through a signed, offline-verifiable license key.

## Tiers

| Tier | Price (suggested) | What it unlocks |
|------|-------------------|-----------------|
| **Free** | $0 forever | Full core: deploy from git, templates, HTTPS, managed DBs, logs & live metrics, projects, RBAC, 2FA (limited to **1 node**) |
| **Home-Lab** | ~$3 / mo | Everything in Free **+ Reverse-tunnels module**, up to **3 nodes** and **3 tunnels** |
| **Pro** | ~$15 / mo | Everything + **all 9 modules** below, **unlimited** nodes & tunnels |

### Quantitative limits

Beyond module gating, each tier caps a few resources (enforced server-side on
creation; mirror of `TIER_LIMITS` in `packages/shared/src/licensing.ts`):

| Tier | Max nodes | Max reverse tunnels |
|------|-----------|---------------------|
| **Free** | 1 | 0 (module locked) |
| **Home-Lab** | 3 | 3 |
| **Pro** | unlimited | unlimited |

### Gated modules

Each module is an independently licensable add-on. A tier grants a set of them;
a license may also grant extra modules à la carte (via the `modules` field in
the key payload).

| Module id | From tier | Description |
|-----------|-----------|-------------|
| `reverse-tunnels` | Home-Lab | Expose services on NAT / home-lab nodes to the internet through a lightweight public relay. |
| `preview-envs` | Pro | Deploy any branch as a disposable, isolated environment (a cloned child service) with its own optional subdomain; auto-torn down by TTL. |
| `offsite-backups` | Pro | Mirror managed-database backups to any S3-compatible bucket, with encrypted credentials and a background upload worker. |
| `alerts` | Pro | Webhook alerts for node-offline, deploy-failed, backup-failed and resource-threshold events, via configurable channels & rules. |
| `metrics-history` | Pro | Periodically sample and store per-node CPU / RAM / disk usage, with history charts. |
| `sso` | Pro | OpenID Connect single sign-on with JWKS verification, domain allow-list and just-in-time user provisioning. |
| `audit-export` | Pro | Organization-wide audit log with server-side filters and CSV / JSON export. |
| `api-cli` | Pro | Personal API tokens (PATs) for programmatic access to the API / CLI, integrated into the JWT auth guard. |
| `white-label` | Pro | Customize the app name, logo, accent color and attribution across the UI and login page. |

Tier → modules mapping lives in `packages/shared/src/licensing.ts`
(`TIER_MODULES`); `Home-Lab = [reverse-tunnels]`, `Pro = all modules`. Adding a
new gated module is a one-line change there plus a `@RequiresModule('...')` on
the backend and (optionally) a nav/page guard.

## Architecture

```
Seller side                         Customer's installation
-----------                         -----------------------
tools/license-issuer  --sign-->     LICENSE KEY  --paste-->  Billing page
  (private key)                                                  │
                                                                 ▼
                                             control-plane verifies (public key)
                                                    → Entitlements (tier, modules)
                                                                 │
                              ┌──────────────────────────────────┼───────────────┐
                              ▼                                    ▼               ▼
                     ModuleGuard (@RequiresModule)      AuthMe.entitlements   GET /license
                     gates paid endpoints               drives UI unlock      Billing page
```

- **Key format:** `base64url(payloadJson).base64url(ed25519Signature)`.
- **Verification:** offline, with an embedded Ed25519 public key
  (`apps/control-plane/src/common/licensing/license.ts`), overridable via
  `LICENSE_PUBLIC_KEY`. No phone-home — works air-gapped.
- **Storage:** the active key lives in the `licenses` table (set via the UI) or
  the `LICENSE_KEY` env var. No valid key ⇒ Free.
- **Enforcement:** backend gates with `ModuleGuard`; a locked call returns a
  coded `license.moduleLocked` error. The frontend hides/soft-gates locked
  features (lock badge in the sidebar, upgrade screen on the page).

## Backend pieces

| File | Role |
|------|------|
| `common/licensing/license.ts` | Verify key, derive entitlements |
| `common/licensing/entitlements.service.ts` | Resolve/cache active key, set/clear |
| `common/licensing/module.guard.ts` + `require-module.decorator.ts` | `@RequiresModule('x')` gating |
| `common/licensing/licensing.controller.ts` | `GET /license`, `PUT /license`, `DELETE /license` |
| `modules/auth/auth.service.ts` (`me`) | Adds `entitlements` to `/auth/me` |

To gate a new feature:

```ts
@UseGuards(JwtAuthGuard, ModuleGuard)
@RequiresModule('offsite-backups')
@Controller('backups')
export class BackupsController { /* ... */ }
```

## Frontend pieces

- `components/entitlements.tsx` — `EntitlementsProvider` + `useEntitlements()`.
- `components/upgrade-notice.tsx` — reusable locked-feature screen.
- `app/billing/page.tsx` — current plan, key activation (admin), pricing + buy links.
- Sidebar shows a lock on gated items that aren't unlocked.

## Selling

The panel is sold from Belarus, where merchant-of-record platforms (Lemon
Squeezy / Paddle / Polar) don't onboard sellers. Instead, a self-hosted payment
microservice (private `self-hosted-pay` repo, deployed at `sh.example.com`) handles
checkout via a Belarusian payment provider (bePaid / Priorbank acquiring),
issues the signed key, and emails it to the buyer.

1. Generate a signing keypair once: `tools/license-issuer/keygen.mjs`, embed the
   public key (see that tool's README). **Do this before production.**
2. Host the landing + checkout on `sh.example.com` (the `self-hosted-pay` service).
3. On a paid order, the pay service verifies the provider webhook, signs a key
   for the purchased tier and emails it to the buyer.
4. Point `NEXT_PUBLIC_BUY_HOMELAB_URL` / `NEXT_PUBLIC_BUY_PRO_URL` at the
   `sh.example.com` checkout URLs for each tier.

See `tools/license-issuer/README.md` for the signing details and the
`self-hosted-pay` repo for the checkout + webhook flow.

## Online activation (optional)

For revocation + seat limits, run the seller-side activation server
(`tools/license-server/`) behind HTTPS and set `LICENSE_ACTIVATION_URL` in the
builds you distribute. The panel then heartbeats on a schedule; paid modules
lock after `LICENSE_ACTIVATION_MAX_AGE_MS` without a successful check. Leave
`LICENSE_ACTIVATION_URL` empty to keep the offline / key-only model.
