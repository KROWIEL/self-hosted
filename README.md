# Self-Hosted PaaS Panel

[![CI](https://github.com/KROWIEL/self-hosted/actions/workflows/ci.yml/badge.svg)](https://github.com/KROWIEL/self-hosted/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#license)
[![Node](https://img.shields.io/badge/Node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Go](https://img.shields.io/badge/Go-%3E%3D1.24-00ADD8?logo=go&logoColor=white)](https://go.dev)
[![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com)
[![Next.js](https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white)](https://nextjs.org)

A self-hosted control panel for deploying **applications** straight from a git
repository into Docker — a lightweight, self-hosted alternative to Heroku /
Railway / Render. Connect a repo, pick a stack template, and the panel builds
and runs your services in containers behind a reverse proxy with automatic
HTTPS.

It is built for small teams: multi-tenant projects with role-based access,
two-factor authentication, an audit trail, managed databases, zero-downtime
deploys and a fully localized (English / Russian) responsive UI.

**Supported stacks out of the box:** Java backends (Maven / Gradle / WAR→Tomcat)
and React (Vite) / Next.js frontends. Any repository that ships its own
`Dockerfile` also works, and admins can add their own templates.

---

## Table of contents

- [Screenshots](#screenshots)
- [Features](#features)
- [Architecture](#architecture)
- [Core concepts](#core-concepts)
- [Repository layout](#repository-layout)
- [Prerequisites](#prerequisites)
- [Quick start (local)](#quick-start-local-one-command)
- [Manual setup](#manual-setup-local-dev)
- [Configuration](#configuration)
  - [Full `.env` example](#full-env-example)
- [Security model](#security-model)
- [Production deployment](#production-deployment)
- [Operations](#operations)
- [Default ports](#default-ports)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Screenshots

> Images live in [`docs/screenshots/`](docs/screenshots). Replace the
> placeholders with your own captures (see that folder's README for the
> recommended shots and file names).

<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="Projects dashboard" width="900" />
</p>

<p align="center">
  <img src="docs/screenshots/deploy.gif" alt="Deploying a service with live build logs" width="900" />
</p>

| Service & logs | Team & roles |
|---|---|
| ![Service detail with live logs](docs/screenshots/service-logs.png) | ![Project members & roles](docs/screenshots/members.png) |

| Templates | Account & 2FA |
|---|---|
| ![Template management](docs/screenshots/templates.png) | ![Account settings & 2FA](docs/screenshots/settings-2fa.png) |

---

## Features

### Deployments

- **Git-based deploys** — connect a repo (public, or private via a Personal
  Access Token), pick a template, deploy. Build logs stream live to the UI.
- **Zero-downtime deployments** — blue-green rollout with agent-side health
  checks; traffic switches to the new container only once it is healthy.
- **Rollback** — redeploy any previous successful image in one click.
- **Auto-deploy webhooks** — push to git → the panel rebuilds and redeploys.
- **Interactive shell** — attach a live terminal to a running container
  (admin-only, over a WebSocket proxy).

### Stacks & templates

- **Built-in templates** — Java 21 (Maven), Java 25 (Gradle), Java WAR → Tomcat,
  Next.js, React (Vite).
- **Custom templates** — administrators can create, edit and delete templates
  (including built-in ones), define build/run images, commands, healthcheck,
  default port and typed variables.
- **Categories** — templates are grouped by category (e.g. Java, JavaScript)
  for quick browsing.

### Multi-tenancy & access control

- **Projects** — group services and databases with their own CPU/RAM quota.
- **Team members & RBAC** — invite users to a project with a role:
  `OWNER`, `ADMIN`, `MEMBER` or `VIEWER`. Every mutating route is enforced
  server-side against the caller's project role.
- **Audit log** — an append-only trail of mutating actions (who, what, when,
  target, project, result). Project admins see their project's trail; platform
  admins see everything.

### Accounts & security

- **Two-stage registration** — create the account (email + password), then
  onboard with personal data and mandatory 2FA setup.
- **Two-factor authentication (TOTP)** — scan a QR code with any authenticator
  app; codes are required at sign-in. Enable/disable from account settings.
- **Account settings** — update personal data, change password, and manage 2FA
  for the currently signed-in user.
- **Strong password policy** — minimum 12 characters, an uppercase and a
  lowercase letter (Unicode-aware), a special character and at least 3 digits.
  A live checklist guides the user on registration and password change.
- **Soft-enforced password rotation** — accounts whose password no longer meets
  the policy are gently forced to change it after sign-in (without ever blocking
  login).
- **Secrets at rest** — PATs, env secrets, TOTP secrets and daemon tokens are
  encrypted with AES-256-GCM.
- **JWT sessions** — short-lived access tokens + refresh tokens.

### Infrastructure & operations

- **Nodes & agent** — register any server; a small Go agent manages Docker on
  it (build, run, logs, metrics, stats, prune). OS-level host metrics (CPU load,
  RAM, disk) are reported per node.
- **Managed databases** — spin up PostgreSQL / MySQL containers per project,
  with scheduled backups and one-click restore.
- **Resource management** — CPU (in cores) and RAM quotas at the platform,
  project and service level, based on the host's detected hardware.
- **Disk cleanup** — a per-node "Clean up" button (docker system/builder/volume
  prune) plus automatic image/container cleanup when services or projects are
  deleted.
- **Reverse tunnels** — expose services running behind NAT/home networks
  through a public VDS relay.
- **Automatic HTTPS** — Traefik issues Let's Encrypt certificates per subdomain
  (HTTP-01) or a wildcard certificate (DNS-01 via Cloudflare).

### User experience

- **Localized UI (EN / RU)** — full internationalization, including
  machine-readable error codes from the API mapped to localized messages.
- **Responsive layout** — a collapsible, icon-based left sidebar that becomes an
  off-canvas drawer on mobile and can be hidden on desktop.
- **Toast notifications** — non-blocking bottom-screen toasts with a countdown
  bar; nothing lingers in the page body.

### Paid modules (open-core)

The core above is free and unlimited. The following add-on modules are gated by
a signed license key (see [`docs/LICENSING.md`](docs/LICENSING.md)). **Home-Lab**
unlocks reverse tunnels; **Pro** unlocks all nine.

| Module | Tier | What it does |
|---|---|---|
| **Reverse tunnels** | Home-Lab | Expose NAT / home-lab nodes to the internet via a public relay. |
| **Preview environments** | Pro | Deploy any branch as a disposable, isolated copy with its own optional subdomain; auto-cleanup by TTL. |
| **Off-site backups** | Pro | Mirror managed-DB backups to any S3-compatible bucket (encrypted credentials). |
| **Alerts** | Pro | Webhook alerts for node-offline, deploy/backup failures and resource thresholds. |
| **Metrics history** | Pro | Store and chart historical CPU / RAM / disk per node. |
| **SSO / OIDC** | Pro | OpenID Connect single sign-on with domain allow-list and JIT provisioning. |
| **Audit export** | Pro | Organization-wide audit log with filters and CSV / JSON export. |
| **API & CLI tokens** | Pro | Personal access tokens (PATs) for programmatic API / CLI access. |
| **White-label** | Pro | Customize app name, logo, accent color and attribution. |

---

## Architecture

A **control plane + agent** design:

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

### Core concepts

| Concept | Meaning |
|---|---|
| `Node` + Agent | A server running the Go agent that manages containers |
| `Project` | A group of services + databases with its own CPU/RAM quota |
| `Member` | A user attached to a project with a role (`OWNER`/`ADMIN`/`MEMBER`/`VIEWER`) |
| `Service` | A deployable unit (a backend or frontend) built from git |
| `Template` | A stack definition describing how to build & run a service |
| `Domain` | A hostname routed to a service via Traefik |
| `Managed database` | A PostgreSQL/MySQL container owned by a project |
| `Tunnel` | A reverse tunnel exposing a NATed node via a public relay |
| `Audit log` | An append-only record of mutating actions |

### Roles

| Role | Can do |
|---|---|
| `VIEWER` | Read-only access to the project |
| `MEMBER` | Deploy and manage services within the project |
| `ADMIN` | Everything MEMBER can, plus manage members, databases, interactive shell, view the project audit log |
| `OWNER` | Full control of the project (assigned to the creator; cannot be removed) |

> Global **platform admins** (the seeded admin / `role = ADMIN`) additionally
> manage templates and can view the platform-wide audit log.

---

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
templates/         Dockerfile templates per stack
docs/              Roadmap and design notes
docker-compose.yml Local infrastructure: Postgres + Redis + Traefik
start.ps1 / start.sh  One-command local launchers (Windows / Linux-macOS)
```

---

## Prerequisites

- **Node.js >= 20** — control plane + web
- **Docker** (with the `docker compose` plugin) — infrastructure + workloads
- **Go >= 1.24** — only needed to build/run the agent (e.g. the local node)

---

## Quick start (local, one command)

The repo ships launcher scripts that set up `.env`, install dependencies, start
Postgres + Redis, push the DB schema, seed the admin user, and run both dev
servers.

**Windows (PowerShell):**

```powershell
./start.ps1
```

If scripts are blocked, run once:
`Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

**Linux / macOS:**

```bash
./start.sh
```

Then open **http://localhost:3000** and sign in with the seeded admin
credentials (`ADMIN_EMAIL` / `ADMIN_PASSWORD` from your `.env`, default
`admin@example.com` / `changeme123`).

> The seeded admin skips onboarding. New accounts created via **Register** go
> through the two-stage flow (account → personal data + 2FA). If the seeded
> password does not meet the strong-password policy, you'll be prompted to
> change it after sign-in.

Re-run flags (skip parts on subsequent runs):

| Windows | Linux/macOS | Effect |
|---|---|---|
| `-SkipInfra` | `--skip-infra` | Don't touch Docker (DB/Redis already running) |
| `-SkipInstall` | `--skip-install` | Don't run `npm install` |
| `-SkipSetup` | `--skip-setup` | Don't push schema / seed admin |

---

## Manual setup (local dev)

```bash
# 1. Environment
cp .env.example .env        # then edit secrets

# 2. Infrastructure (Postgres, Redis, Traefik)
docker compose up -d postgres redis

# 3. Install JS dependencies (workspaces)
npm install

# 4. Build shared types
npm run build --workspace @selfhosted/shared

# 5. Database: push schema + seed the admin user
npm run db:push
npm run db:seed

# 6. Run the control plane and web (separate terminals)
npm run dev:cp     # API  → http://localhost:3001/api/v1
npm run dev:web    # UI   → http://localhost:3000

# 7. (Optional) build the agent
cd services/agent && go build ./...
```

### Running a local node/agent

For a single-machine setup, the control plane can spawn a local agent for you.
Set in `.env`:

```
LOCAL_AGENT_ENABLED=1
AGENT_INSECURE_HTTP=1     # local agent runs over plain HTTP
```

Then create a node in the UI (**Nodes → Add node**) and press **Start agent**.
The control plane runs the agent binary with the node's daemon token.

> Note: after updating agent code, **Stop agent → Start agent** to pick up the
> changes.

---

## Configuration

Copy `.env.example` to `.env`. Key variables:

| Variable | Purpose |
|---|---|
| `CP_PORT` | Control-plane API port (default `3001`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection (BullMQ build queue) |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Panel session signing keys |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Access/refresh token lifetimes |
| `ENCRYPTION_KEY` | 32-byte base64 key for AES-256-GCM secrets at rest |
| `TOTP_ISSUER` | Issuer label shown in authenticator apps for 2FA |
| `AGENT_JWT_PRIVATE_KEY_PATH` | Private key the panel uses to sign agent JWTs |
| `AGENT_INSECURE_HTTP` | `1` to reach a local agent over plain HTTP (dev only) |
| `LOCAL_AGENT_ENABLED` | `1` to let the panel spawn a local agent (dev only) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | First-run admin seeded by `db:seed` |
| `ACME_EMAIL` | Email for Let's Encrypt registration |
| `ACME_WILDCARD_CERTS` / `CLOUDFLARE_DNS_API_TOKEN` | Wildcard TLS via DNS-01 |
| `NEXT_PUBLIC_API_URL` | API base URL used by the web app |

Generate strong secrets, e.g.:

```bash
openssl rand -base64 32     # ENCRYPTION_KEY, JWT secrets
```

Agent-only variables (set on each node) live in `services/agent/.env.example`.

### Full `.env` example

The complete, annotated template (kept in sync with [`.env.example`](.env.example)):

```dotenv
# ============================================================
# Self-Hosted PaaS — example environment
# Copy to .env and fill in. Never commit the real .env.
# ============================================================

# --- Control plane (NestJS) ---
NODE_ENV=development
CP_PORT=3001

# PostgreSQL (managed by Drizzle ORM)
DATABASE_URL=postgresql://selfhosted:selfhosted@localhost:5432/selfhosted?sslmode=disable

# Redis (BullMQ build queue)
REDIS_URL=redis://localhost:6379

# JWT for user sessions (panel UI -> control plane)
JWT_SECRET=change-me-access-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=change-me-refresh-secret
JWT_REFRESH_EXPIRES_IN=7d

# Master key for AES-256-GCM encryption of secrets at rest
# (PATs, env secrets, daemon tokens). 32 bytes, base64-encoded.
# Generate: openssl rand -base64 32
ENCRYPTION_KEY=change-me-32-byte-base64-key

# Private key (PEM) used by control plane to sign JWTs sent to agents.
# Generate a keypair; agents store the matching public key.
AGENT_JWT_PRIVATE_KEY_PATH=./secrets/agent-jwt-private.pem

# Dev only: let the control plane reach a local agent over plain HTTP
# (instead of https). Set to 1 when running the agent on localhost without TLS.
AGENT_INSECURE_HTTP=0

# Dev only: allow starting/stopping the local Go agent from the UI. The control
# plane spawns `go run ./cmd/agent` (or AGENT_BINARY) with the node's token.
# NEVER enable in production — it lets the API spawn local processes.
LOCAL_AGENT_ENABLED=0
# Optional overrides for the local agent launcher:
# AGENT_LOCAL_DIR=/abs/path/to/services/agent
# AGENT_BINARY=/abs/path/to/agent.exe

# First-run admin seeded by `npm run db:seed`.
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=changeme123

# Email used by Traefik for Let's Encrypt certificate registration.
ACME_EMAIL=admin@example.com

# Subdomain TLS (pick one approach):
#
# A) HTTP-01 (default, no extra config): add a wildcard DNS record
#    *.yourdomain.com → VDS IP. Traefik issues a cert per subdomain on first
#    HTTPS visit (resolver: letsencrypt).
#
# B) DNS-01 wildcard cert (*.yourdomain.com + yourdomain.com in one cert):
#    1. Point DNS to Cloudflare (or set ACME_DNS_PROVIDER in docker-compose).
#    2. Create a Cloudflare API token with Zone:DNS:Edit for the domain.
#    3. Set CLOUDFLARE_DNS_API_TOKEN below and ACME_WILDCARD_CERTS=1 on the agent.
#    4. Restart Traefik (docker compose up -d traefik) and redeploy services.
ACME_WILDCARD_CERTS=0
# ACME_CERT_RESOLVER=letsencrypt-dns
# CLOUDFLARE_DNS_API_TOKEN=
# ACME_DNS_PROVIDER=cloudflare

# --- Web (Next.js) ---
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

# --- Agent (Go daemon) — used on each node, not by the panel ---
AGENT_PORT=8443
AGENT_TLS_CERT=/etc/self-hosted-agent/cert.pem
AGENT_TLS_KEY=/etc/self-hosted-agent/key.pem
# Public key (PEM) matching control plane's signing key, to verify incoming JWTs
AGENT_JWT_PUBLIC_KEY_PATH=/etc/self-hosted-agent/agent-jwt-public.pem
# Shared registration token issued by the panel when the node is created
# (returned once as `daemonTokenPlaintext` by POST /api/v1/nodes).
AGENT_DAEMON_TOKEN=change-me-daemon-token
# Where the agent clones repos during builds (prefer tmpfs in prod).
AGENT_WORKDIR=/tmp/agent-builds
# Docker network deployed service containers join. Use the shared edge network
# (created by docker-compose) so Traefik can route to them by domain.
AGENT_NETWORK=selfhosted-edge
# Root of the Dockerfile templates shipped with the agent.
AGENT_TEMPLATES_DIR=/opt/agent/templates
# Dev only: publish deployed service ports to the host so apps are reachable at
# localhost:<port> without a reverse proxy. Leave 0 in production (use Traefik).
AGENT_PUBLISH_PORTS=0
```

---

## Security model

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
- **Secrets at rest:** Git PATs, service env secrets, user TOTP secrets and node
  daemon tokens are AES-256-GCM encrypted.
- **Agent trust:** every agent call requires `Authorization: Bearer
  <daemon token>`; tokens are generated per node and stored encrypted.
- **Localized, coded errors:** the API returns stable error `code`s that the UI
  maps to localized messages, so users never see raw internal strings.

---

## Production deployment

This guide covers a single control-plane host plus one or more worker nodes.

### 1. Prepare the control-plane host

Requirements: Docker + `docker compose`, Node.js >= 20, a domain, and open
ports **80/443** (Traefik).

```bash
git clone <your-fork-url> self-hosted && cd self-hosted
cp .env.example .env
```

Harden `.env` for production:

- Set unique `JWT_SECRET`, `JWT_REFRESH_SECRET`, and a fresh `ENCRYPTION_KEY`.
- Set a strong `ADMIN_PASSWORD` (that satisfies the password policy).
- Set `ACME_EMAIL` to a real address.
- Leave `AGENT_INSECURE_HTTP=0` and `LOCAL_AGENT_ENABLED=0`.
- Generate the agent JWT keypair referenced by `AGENT_JWT_PRIVATE_KEY_PATH`.

### 2. Start infrastructure (Postgres, Redis, Traefik)

```bash
docker compose up -d
```

Traefik terminates TLS and routes deployed services by hostname. Certificates
are issued automatically:

- **HTTP-01 (default):** add a wildcard DNS record `*.yourdomain.com → host IP`.
  A cert is issued per subdomain on first HTTPS visit.
- **DNS-01 wildcard:** set `ACME_WILDCARD_CERTS=1` and `CLOUDFLARE_DNS_API_TOKEN`
  (Zone:DNS:Edit) to get a single `*.yourdomain.com` certificate.

### 3. Build and run the control plane + web

```bash
npm install
npm run build                       # builds shared, control-plane, web
npm run db:push                     # apply schema
npm run db:seed                     # seed the admin (first run only)

# Start the API and UI (use a process manager, e.g. pm2/systemd)
node apps/control-plane/dist/main.js          # API  (CP_PORT, default 3001)
npm run start --workspace @selfhosted/web     # UI   (port 3000)
```

Put the web UI (3000) and API (3001) behind your reverse proxy / Traefik with
your panel domain and TLS. Point `NEXT_PUBLIC_API_URL` at the public API URL.

### 4. Register a worker node and install the agent

On each server that will run workloads:

1. In the panel: **Nodes → Add node**, enter the host/IP and agent port
   (default `8443`). Copy the one-time **daemon token** shown after creation.
2. On the node, install Docker and the agent:

```bash
# Build the agent (or copy a prebuilt binary)
cd services/agent && go build -o /usr/local/bin/self-hosted-agent ./cmd/agent

# Configure it
cp .env.example /etc/self-hosted-agent.env    # then edit
#   AGENT_DAEMON_TOKEN=<paste the token from the panel>
#   AGENT_NETWORK=selfhosted-edge             # shared network with Traefik
#   AGENT_WORKDIR=/var/lib/self-hosted/builds

# Run it (use systemd for production)
env $(cat /etc/self-hosted-agent.env | xargs) self-hosted-agent
```

3. Back in the panel the node shows **Running** with live metrics (including
   host CPU load / RAM / disk). You can now create services on it.

### 5. Deploy your first app

1. **Git access → Add** a PAT if the repo is private.
2. **Projects → Create project** (set its CPU/RAM quota). You become its `OWNER`.
3. (Optional) **Members** → invite teammates with a role.
4. Inside the project: **Create service**, choose the repo, branch and template.
5. Deploy. Watch build logs stream in; on success the service goes live.
6. (Optional) attach a domain to route public traffic via Traefik with HTTPS.

### 6. Exposing a NATed node (optional)

If a node has no public IP, use **Exposure/Tunnels** to relay traffic through a
public VDS. The panel generates install assets (see `services/tunnel-dist`) for
the relay side.

---

## Operations

- **Zero-downtime deploys:** new containers are health-checked before Traefik
  switches traffic; the old container is removed after promotion.
- **Rollback:** open a service → Deployments → redeploy a previous image.
- **Members:** project admins/owners manage members and roles from the project
  page; the owner role is reserved for the creator.
- **Audit:** review mutating actions per project (admins/owner) or platform-wide
  (global admin).
- **Templates:** platform admins create/edit/delete templates and organize them
  into categories.
- **Backups:** managed databases support scheduled backups and one-click
  restore from the service/database view.
- **Disk cleanup:** on a node card press **Clean up** to reclaim space
  (`docker system prune` + build cache; optionally all unused images/volumes).
  Deleting a service or project also removes its containers/images on the node.

---

## Default ports

| Service | Port |
|---|---|
| Web UI | `3000` |
| Control-plane API | `3001` (`/api/v1`) |
| Agent | `8443` |
| Traefik | `80`, `443` |
| PostgreSQL | `5432` |
| Redis | `6379` |

---

## Troubleshooting

- **Node shows "Running" but unreachable:** the control plane can't reach the
  agent host:port. Check the agent process, firewall, and (dev) that
  `AGENT_INSECURE_HTTP` matches the agent's scheme.
- **"Clean up" button does nothing / 404:** a locally spawned agent is running
  old code. **Stop agent → Start agent** to recompile.
- **Certificates not issued:** verify DNS points to the host and ports 80/443
  are reachable; for wildcard certs check `CLOUDFLARE_DNS_API_TOKEN`.
- **Can't sign in after 2FA setup:** enter the current 6-digit code from your
  authenticator app; ensure the device clock is accurate (TOTP is time-based).
- **Forced to the settings page after login:** your password no longer meets the
  policy — set a stronger one to continue (login itself is never blocked).
- **"Requires … role on this project" errors:** you lack the required project
  role; ask an `ADMIN`/`OWNER` to grant it under **Members**.
- **Next.js dev assets 404 after a build:** stop `next dev`, delete
  `apps/web/.next`, then restart the dev server.

---

## License

MIT
