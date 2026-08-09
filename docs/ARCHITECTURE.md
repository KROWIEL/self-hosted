# Architecture

A **control plane + agent** design: one panel orchestrates any number of
servers, each running a small Go daemon that owns Docker locally.

| Component | Path | Stack | Role |
|---|---|---|---|
| **Control plane** | `apps/control-plane` | NestJS + Drizzle ORM + PostgreSQL + Redis (BullMQ) | API, auth/2FA, RBAC, projects/services, build orchestration, quotas, audit |
| **Web UI** | `apps/web` | Next.js + Tailwind | Dashboard, logs, env editor, members, audit, settings, i18n |
| **Agent** | `services/agent` | Go + Docker CLI | Runs on each node: build, run, health checks, logs, metrics, host stats, prune |
| **Templates** | `templates/` | Dockerfile | Stack build/run recipes per supported stack |
| **Shared** | `packages/shared` | TypeScript | Shared types/enums between control plane and web |
| **Tunnel** | `services/tunnel-dist` | Xray | Reverse-tunnel relay assets for exposing NATed nodes |

```
                 ┌────────────┐        HTTPS         ┌───────────────┐
   browser ────► │   Web UI   │ ───────────────────► │ Control plane │
                 │ (Next.js)  │   REST /api/v1        │   (NestJS)    │
                 └────────────┘                       └──────┬────────┘
                                                             │ Bearer daemon token
                                                             ▼
   users ──► Traefik ──► service containers ◄──── manages ── Go agent (per node)
             (HTTPS)                                          └─ Docker
```

## Core concepts

| Concept | Meaning |
|---|---|
| `Node` + Agent | A server running the Go agent that manages containers |
| `Project` | A group of services + databases with its own CPU/RAM quota |
| `Member` | A user attached to a project with a role (`OWNER`/`ADMIN`/`MEMBER`/`VIEWER`) |
| `Service` | A deployable unit (`deployKind`: git / image / compose) |
| `Template` | A stack definition describing how to build & run a git service |
| `Catalog app` | A curated installable app (image/compose/git), free on every tier |
| `Domain` | A hostname routed to a service via Traefik |
| `Managed database` | A PostgreSQL/MySQL container owned by a project |
| `Tunnel` | A reverse tunnel exposing a NATed node via a public relay |
| `Audit log` | An append-only record of mutating actions |

## Roles

| Role | Can do |
|---|---|
| `VIEWER` | Read-only access to the project |
| `MEMBER` | Deploy and manage services within the project |
| `ADMIN` | Everything MEMBER can, plus manage members, databases, interactive shell, view the project audit log |
| `OWNER` | Full control of the project (assigned to the creator; cannot be removed) |

> Global **platform admins** (the seeded admin / `role = ADMIN`) additionally
> manage templates and can view the platform-wide audit log.

## Build pipeline

A deploy of a git service flows through the queue and the agent:

1. The control plane records a `Deployment` and enqueues a BullMQ job.
2. The worker decrypts the repo PAT, calls the agent's build endpoint, and
   streams the build log back over Redis pub/sub to the UI.
3. The agent clones the branch into a scratch directory, runs the build (a
   template's install image, the repo's own `Dockerfile`, or Nixpacks), and
   tags a runtime image. The PAT never touches disk or an image layer.
4. On success the agent starts the new container with the service's env, limits
   and Traefik labels, health-checks it, then removes the old one.
5. The previous image is kept so a rollback is a plain `docker run`, no rebuild.

## Repository layout

```
apps/
  control-plane/   NestJS API (auth/2FA, members/RBAC, audit, nodes, projects,
                   services, databases, templates, git-credentials, tunnels,
                   backups, deploy worker)
  web/             Next.js dashboard (i18n, settings, members, audit, templates)
packages/
  shared/          Shared TypeScript types / enums
services/
  agent/           Go agent (installed on each node)
  tunnel-dist/     Reverse-tunnel relay install scripts
catalog/apps/      One-click app manifests (one JSON file per app)
templates/         Dockerfile templates per stack
tools/
  catalog/         Validates app manifests, tracks them against upstream
docs/              Install guide, architecture, licensing, roadmap, screenshots
docker-compose.yml Local infrastructure: Postgres + Redis + Traefik
start.ps1 / start.sh  One-command local launchers (Windows / Linux-macOS)
```

The seller-side licensing and payment service is **not** part of this
repository; the panel only carries the offline verifier. See
[`LICENSING.md`](LICENSING.md).

## Security model

Practical hardening in the free core (not a claim of third-party audit):

- **Authentication:** email + password, optional TOTP 2FA, JWT access/refresh
  tokens. Passwords are hashed with bcrypt.
- **Password policy:** ≥ 12 chars, upper + lower (any script), ≥ 3 digits and a
  special character. Enforced identically on the client (live checklist) and the
  server. Weak legacy passwords trigger a soft, non-blocking change prompt.
- **Authorization (RBAC):** project routes are guarded by a role decorator +
  guard that resolves the target project from the request and checks the
  caller's membership role. Interactive shells and member management require
  `ADMIN`.
- **Audit trail:** an interceptor records mutating requests (actor, action,
  target, project, HTTP status) to an append-only table.
- **Secrets at rest:** Git PATs, service env secrets, custom TLS PEMs, user TOTP
  secrets and node daemon tokens are AES-256-GCM encrypted.
- **Agent trust:** every agent call requires `Authorization: Bearer
  <daemon token>`; tokens are generated per node, stored encrypted, and rotated
  on a schedule. Remote agents use TLS pinning where configured.
- **Rate limiting:** per-IP throttling on every route, with tighter caps on
  sign-in and token refresh.
- **Webhook signatures:** GitHub/GitLab PR webhooks (Pro / `preview-envs`) verify
  shared secrets before creating preview environments.
- **Localized, coded errors:** the API returns stable error `code`s that the UI
  maps to localized messages, so users never see raw internal strings.
