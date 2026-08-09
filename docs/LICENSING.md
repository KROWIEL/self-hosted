# Licensing & monetization

This panel is **open-core**: a generous free core drives adoption, and paid tiers
unlock add-on modules through a signed, offline-verifiable license key.

> **Buyers:** activate a paid plan under **Billing → License key** (admin only), or
> set the `LICENSE_KEY` env var. No key ⇒ the free core.
>
> **Note:** the seller-side license *issuer* (the private signing key + key
> generator) is **not** part of this repository. This repo only contains the
> offline *verifier* (a public key) — that is by design and safe to publish.

## Activation modes

The panel supports two modes, chosen by the operator via `.env`:

- **Offline / key-only** (default, no `LICENSE_ACTIVATION_URL`): the key is
  verified locally (signature + expiry). Works air-gapped.
- **Online activation** (`LICENSE_ACTIVATION_URL` set): the panel sends a
  periodic heartbeat to an activation server. Paid modules stay unlocked only
  while a recent heartbeat succeeded; without contact they lock after the grace
  window (`LICENSE_ACTIVATION_MAX_AGE_MS`). This enables revocation and seat
  limits. The activation server is seller-side and not distributed here.

  A key is licensed to a fixed number of machines, so removing or replacing it
  in **Billing** also tells the server this installation is done with it and the
  place can go to another machine. That call goes to `LICENSE_RELEASE_URL`,
  which defaults to the activation URL with `/activate` swapped for `/release`;
  set it explicitly if the seller's endpoint sits elsewhere. It is best effort —
  if it does not land, the customer can unbind the machine from the seller's
  portal instead.

### What the heartbeat says about this machine

A licence sold for one machine has to be able to tell which one, and the
installation's own instance id cannot answer that — it lives in this panel's
database and travels with a copy of it. So the heartbeat also carries a few
hashed marks of the host: the systemd machine-id, the DMI product uuid and board
serial where readable, and a coarse profile of processor and memory
(`apps/control-plane/src/common/licensing/hardware.ts`).

Each mark is an HMAC keyed by the licence key itself. No identifier leaves the
machine in the clear, and the same host under two different licences produces
two unrelated sets of marks, so nothing here can be used to correlate
installations. A seller can only ask "is this the same machine as last time".

In a container none of those files describe the host, so mount the host's own
copies read-only:

```yaml
volumes:
  - /etc/machine-id:/host/etc/machine-id:ro
  - /sys/class/dmi/id:/host/sys/class/dmi/id:ro
```

Without them the panel logs a warning once and activates on the instance id
alone, which a seller is free to refuse (`hardware_required`). Running the
control plane directly on the host needs no configuration: `/etc/machine-id` is
world-readable and is enough on its own.

An activation refused with `hardware_mismatch` means the key is in use on a
different machine; unbind the old one in the seller's customer portal.

### Fleet licences

An Enterprise key covers a whole estate, so it is not pinned to any machine.
What vouches for a machine instead is a fleet secret issued with the licence and
deployed beside the key:

```
LICENSE_FLEET_SECRET=shf_…
```

Without it the server answers `fleet_secret` and the key unlocks nothing, which
is what keeps a leaked company key harmless. The secret can be reissued from the
customer portal if it escapes.

## Tiers

| Tier | Price (suggested) | What it unlocks |
|------|-------------------|-----------------|
| **Free** | $0 forever | Full core: git / image / compose deploys, templates & Nixpacks, the **complete app catalog**, HTTPS + custom PEMs, managed DBs, volumes, logs & live metrics, projects, RBAC, 2FA (**1 node**, **0 tunnels**) |
| **Home-Lab** | ~$3 / mo | Everything in Free **+** `reverse-tunnels` **+** `service-cron`, up to **3 nodes** and **3 tunnels** |
| **Pro** | ~$15 / mo | Everything + **all 11 modules** below, **unlimited** nodes & tunnels |
| **Enterprise** | ~$999 / mo | Exactly what Pro unlocks, licensed to an organisation: **one key across a fleet of up to 5000 installations**, for hosting providers running the panel for their customers and for companies running it across an estate |

Free, Home-Lab and Pro are personal: one key covers one machine at a time, and
moving it means unbinding the old one. Enterprise is the only tier that seats
many machines on a single key. Nothing in *this* repository is aware of that
difference — a key's tier decides what one installation may do, and how many
installations share the key is a question for the activation server, which
answers `seat_limit` when a licence is full.

### Quantitative limits

Beyond module gating, each tier caps a few resources (enforced server-side on
creation; mirror of `TIER_LIMITS` in `packages/shared/src/licensing.ts`):

| Tier | Max nodes | Max reverse tunnels |
|------|-----------|---------------------|
| **Free** | 1 | 0 (module locked) |
| **Home-Lab** | 3 | 3 |
| **Pro** | unlimited | unlimited |
| **Enterprise** | unlimited | unlimited |

### Gated modules

Each module is an independently licensable add-on. A tier grants a set of them;
a license may also grant extra modules à la carte (via the `modules` field in
the key payload).

| Module id | From tier | Description |
|-----------|-----------|-------------|
| `reverse-tunnels` | Home-Lab | Expose services on NAT / home-lab nodes to the internet through a lightweight public relay. |
| `service-cron` | Home-Lab | Schedule commands inside a running service container (cron expressions via BullMQ). |
| `preview-envs` | Pro | Deploy any branch as a disposable, isolated environment (a cloned child service) with its own optional subdomain; auto-torn down by TTL. GitHub/GitLab PR webhooks (`/git-apps`) create/update previews. |
| `offsite-backups` | Pro | Mirror managed-database backups to S3, GCS, Azure Blob, or SFTP, with encrypted credentials and a background upload worker. |
| `alerts` | Pro | Alerts for node-offline, deploy-failed, backup-failed and resource-threshold events via webhook, Discord, Slack, or Telegram channels. |
| `metrics-history` | Pro | Periodically sample and store per-node CPU / RAM / disk usage, with history charts. |
| `sso` | Pro | OpenID Connect single sign-on with JWKS verification, domain allow-list and just-in-time user provisioning. |
| `audit-export` | Pro | Organization-wide audit log with server-side filters and CSV / JSON export. |
| `api-cli` | Pro | Personal API tokens (PATs) for programmatic access to the API / CLI, integrated into the JWT auth guard. |
| `white-label` | Pro | Customize the app name, logo, accent color and attribution across the UI and login page. |
| `email` | Pro | Outbound email over your own SMTP provider: send test messages and broadcast announcements to all users or a specific list, with encrypted credentials and a delivery log. |

Tier → modules mapping lives in `packages/shared/src/licensing.ts`
(`TIER_MODULES`); `Home-Lab = [reverse-tunnels, service-cron]`, `Pro = all
modules`, `Enterprise = all modules`. Adding a new gated module is a one-line
change there plus a `@RequiresModule('...')` on the backend and (optionally) a
nav/page guard.

## Architecture

```
Seller side                         Customer's installation
-----------                         -----------------------
licensing service     --sign-->     LICENSE KEY  --paste-->  Billing page
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

## Activating a paid plan (buyers)

1. Purchase a plan; you receive a license key by email.
2. In the panel, go to **Billing → License key** (admin) and paste it — or set
   `LICENSE_KEY` in your `.env`.
3. Point checkout links via `NEXT_PUBLIC_BUY_HOMELAB_URL`,
   `NEXT_PUBLIC_BUY_PRO_URL` and `NEXT_PUBLIC_BUY_ENTERPRISE_URL` if you
   self-host a store.

The signing/issuing side (private key, key generator, store webhook) lives in the
seller's private tooling and is intentionally not distributed here.
