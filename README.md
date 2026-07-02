# Self-Hosted PaaS Panel

A self-hosted control panel for deploying **applications** straight from a git
repository into Docker — a lightweight, self-hosted alternative to Heroku /
Railway / Render. Connect a repo, pick a stack template, and the panel builds
and runs your services in containers behind a reverse proxy with automatic
HTTPS.

**Supported stacks (MVP):** Java backends (Maven/Gradle) and React/Next.js
frontends. Any repository that ships its own `Dockerfile` also works.

---

## Features

- **Git-based deploys** — connect a repo (public or private via PAT), pick a
  template, deploy. Build logs stream live to the UI.
- **Zero-downtime deployments** — blue-green rollout with agent-side health
  checks; traffic is only switched to the new container once it is healthy.
- **Rollback** — redeploy any previous successful image in one click.
- **Auto-deploy webhooks** — push to git → the panel rebuilds and redeploys.
- **Managed databases** — spin up PostgreSQL / MySQL containers per project,
  with scheduled backups and one-click restore.
- **Nodes & agent** — register any server; a small Go agent manages Docker on
  it (build, run, logs, metrics, stats).
- **Resource management** — CPU (in cores) and RAM quotas at the platform,
  project and service level, based on the host's detected hardware.
- **Disk cleanup** — a per-node "Clean up" button (docker system/builder/volume
  prune) plus automatic image/container cleanup when services or projects are
  deleted.
- **Reverse tunnels** — expose services running behind NAT/home networks
  through a public VDS relay.
- **Automatic HTTPS** — Traefik issues Let's Encrypt certificates per subdomain
  (HTTP-01) or a wildcard certificate (DNS-01 via Cloudflare).
- **Secrets at rest** — PATs, env secrets and daemon tokens are encrypted with
  AES-256-GCM.

---

## Architecture

A **control plane + agent** design:

| Component | Path | Stack | Role |
|---|---|---|---|
| **Control plane** | `apps/control-plane` | NestJS + Drizzle ORM + PostgreSQL + Redis (BullMQ) | API, auth, projects/services, build orchestration, quotas |
| **Web UI** | `apps/web` | Next.js + Tailwind | Dashboard, logs, env editor, resource management |
| **Agent** | `services/agent` | Go + Docker CLI | Runs on each node: build, run, health checks, logs, metrics, prune |
| **Templates** | `templates/` | Dockerfile | Stack build/run recipes per supported stack |
| **Shared** | `packages/shared` | TypeScript | Shared types/DTOs between control plane and web |
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
| `Service` | A deployable unit (a backend or frontend) built from git |
| `Template` | A stack definition describing how to build & run a service |
| `Domain` | A hostname routed to a service via Traefik |
| `Managed database` | A PostgreSQL/MySQL container owned by a project |
| `Tunnel` | A reverse tunnel exposing a NATed node via a public relay |

---

## Repository layout

```
apps/
  control-plane/   NestJS API (auth, nodes, projects, services, databases,
                   templates, git-credentials, tunnels, backups, deploy worker)
  web/             Next.js dashboard
packages/
  shared/          Shared TypeScript types / DTOs
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
The control plane runs `go run ./cmd/agent` with the node's daemon token.

> Note: the local agent is compiled on start via `go run`. After updating agent
> code, **Stop agent → Start agent** to pick up the changes.

---

## Configuration

Copy `.env.example` to `.env`. Key variables:

| Variable | Purpose |
|---|---|
| `CP_PORT` | Control-plane API port (default `3001`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection (BullMQ build queue) |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Panel session signing keys |
| `ENCRYPTION_KEY` | 32-byte base64 key for AES-256-GCM secrets at rest |
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
- Set a strong `ADMIN_PASSWORD`.
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

3. Back in the panel the node shows **Running** with live metrics. You can now
   create services on it.

All agent requests require `Authorization: Bearer <AGENT_DAEMON_TOKEN>`; the
token is stored encrypted in the control plane.

### 5. Deploy your first app

1. **Git access → Add** a PAT if the repo is private.
2. **Projects → Create project** (set its CPU/RAM quota).
3. Inside the project: **Create service**, choose the repo, branch and template.
4. Deploy. Watch build logs stream in; on success the service goes live.
5. (Optional) attach a domain to route public traffic via Traefik with HTTPS.

### 6. Exposing a NATed node (optional)

If a node has no public IP, use **Exposure/Tunnels** to relay traffic through a
public VDS. The panel generates install assets (see `services/tunnel-dist`) for
the relay side.

---

## Operations

- **Zero-downtime deploys:** new containers are health-checked before Traefik
  switches traffic; the old container is removed after promotion.
- **Rollback:** open a service → Deployments → redeploy a previous image.
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
  old code. **Stop agent → Start agent** to recompile via `go run`.
- **Certificates not issued:** verify DNS points to the host and ports 80/443
  are reachable; for wildcard certs check `CLOUDFLARE_DNS_API_TOKEN`.
- **Next.js dev assets 404 after a build:** stop `next dev`, delete
  `apps/web/.next`, then restart the dev server.

---

## License

MIT
