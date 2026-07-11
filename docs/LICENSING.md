# Licensing & monetization

This panel is **open-core**: a generous free core drives adoption, and paid tiers
unlock add-on modules through a signed, offline-verifiable license key.

## Tiers

| Tier | Price (suggested) | What it unlocks |
|------|-------------------|-----------------|
| **Free** | $0 forever | Full core: deploy from git, templates, HTTPS, managed DBs, logs & live metrics, projects, RBAC, 2FA, unlimited nodes |
| **Home-Lab** | ~$3 / mo | Everything in Free **+ Reverse-tunnels module** (expose NAT / home-lab nodes) |
| **Pro** | ~$15 / mo | Everything + all modules (preview-envs, off-site backups, alerts, metrics history, SSO, audit export, API/CLI, white-label) |

Tier → modules mapping lives in `packages/shared/src/licensing.ts`
(`TIER_MODULES`). Adding a new gated module is a one-line change there plus a
`@RequiresModule('...')` on the backend and (optionally) a nav/page guard.

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

1. Generate a signing keypair once: `tools/license-issuer/keygen.mjs`, embed the
   public key (see that tool's README). **Do this before production.**
2. Sell via a merchant-of-record (Lemon Squeezy / Polar / Paddle) for subscriptions,
   or Gumroad / CodeCanyon for one-time copies.
3. On a paid order, a webhook issues + emails a key (`webhook-example.mjs`).
4. Point `NEXT_PUBLIC_BUY_HOMELAB_URL` / `NEXT_PUBLIC_BUY_PRO_URL` at your checkout.

See `tools/license-issuer/README.md` for the operational details.
