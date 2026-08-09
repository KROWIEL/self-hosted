# Installation & operations

Everything needed to run the panel locally, configure it, and deploy it to
production. For how the pieces fit together see
[`ARCHITECTURE.md`](ARCHITECTURE.md).

- [Prerequisites](#prerequisites)
- [Quick start (local, one command)](#quick-start-local-one-command)
- [Manual setup (local dev)](#manual-setup-local-dev)
- [Running a local node/agent](#running-a-local-nodeagent)
- [Configuration](#configuration)
- [Production deployment](#production-deployment)
- [Operations](#operations)
- [Default ports](#default-ports)
- [Troubleshooting](#troubleshooting)

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

Copy [`.env.example`](../.env.example) to `.env` — it is the annotated source of
truth and documents every variable, including the optional ones omitted here.
The settings you are most likely to touch:

### Control plane

| Variable | Purpose |
|---|---|
| `CP_PORT` | Control-plane API port (default `3001`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection (BullMQ build queue) |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Panel session signing keys. Startup fails on a missing, short, or placeholder value |
| `JWT_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Access/refresh token lifetimes |
| `WEBHOOK_SECRET` | Signs deploy-webhook tokens; kept separate from the JWT secrets so either can be rotated alone |
| `ENCRYPTION_KEY` | 32-byte base64 key for AES-256-GCM secrets at rest |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | First-run admin seeded by `db:seed` |
| `ALLOW_OPEN_REGISTRATION` | `1` to allow anonymous sign-up (off by default) |
| `DAEMON_TOKEN_ROTATION_DAYS` | Auto-rotate node daemon tokens (default 30; `0` disables) |

### Rate limiting

Per client IP, with production defaults; `NODE_ENV=development` relaxes them
automatically so hot reloads and several open tabs don't trip the limiter.

| Variable | Default | Applies to |
|---|---|---|
| `THROTTLE_TTL_MS` | `60000` | Window all limits are measured over |
| `THROTTLE_LIMIT` | `120` | Global cap on every route |
| `THROTTLE_AUTH_LIMIT` | `5` | Login, 2FA enable/disable |
| `THROTTLE_REFRESH_LIMIT` | `10` | `POST /auth/refresh` |

Behind a reverse proxy that hides client IPs, or with many users on one NAT,
`THROTTLE_LIMIT` is the one to raise.

### Agents & TLS

| Variable | Purpose |
|---|---|
| `AGENT_JWT_PRIVATE_KEY_PATH` | Private key the panel uses to sign agent JWTs |
| `AGENT_INSECURE_HTTP` | `1` to reach a local agent over plain HTTP (dev only) |
| `LOCAL_AGENT_ENABLED` | `1` to let the panel spawn a local agent (dev only) |
| `ACME_EMAIL` | Email for Let's Encrypt registration |
| `ACME_WILDCARD_CERTS` / `CLOUDFLARE_DNS_API_TOKEN` | Wildcard TLS via DNS-01 |

Agent-only variables (set on each node) live in
[`services/agent/.env.example`](../services/agent/.env.example): `AGENT_PORT`,
`AGENT_DAEMON_TOKEN`, `AGENT_WORKDIR`, `AGENT_NETWORK`, `AGENT_TEMPLATES_DIR`,
`AGENT_NIXPACKS_BIN` and friends.

### Web & licensing

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | API base URL used by the web app |
| `PUBLIC_API_URL` / `APP_BASE_URL` | Externally reachable URLs, needed for OIDC redirects behind a domain |
| `NEXT_PUBLIC_BUY_HOMELAB_URL` / `NEXT_PUBLIC_BUY_PRO_URL` / `NEXT_PUBLIC_BUY_ENTERPRISE_URL` | Checkout links on the Billing page |
| `LICENSE_KEY` | Pin a license key instead of activating it in the UI |
| `LICENSE_PUBLIC_KEY` | Override the verification key if you issue your own licenses |
| `LICENSE_ACTIVATION_URL` | Enable online activation (see [`LICENSING.md`](LICENSING.md)) |
| `LICENSE_RELEASE_URL` | Where removing a key frees the machine; defaults to the activation URL with `/activate` → `/release` |
| `LICENSE_FLEET_SECRET` | Enterprise only: the secret issued with a fleet licence, without which the key activates nothing |

Generate strong secrets, e.g.:

```bash
openssl rand -base64 32     # ENCRYPTION_KEY, WEBHOOK_SECRET
openssl rand -base64 48     # JWT_SECRET, JWT_REFRESH_SECRET
```

---

## Production deployment

This guide covers a single control-plane host plus one or more worker nodes.

### 1. Prepare the control-plane host

Requirements: Docker + `docker compose`, Node.js >= 20, a domain, and open
ports **80/443** (Traefik).

```bash
git clone https://github.com/KROWIEL/self-hosted.git && cd self-hosted
cp .env.example .env
```

Harden `.env` for production:

- Set unique `JWT_SECRET`, `JWT_REFRESH_SECRET`, `WEBHOOK_SECRET`, and a fresh
  `ENCRYPTION_KEY`.
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
- **App catalog:** manifests in [`catalog/apps`](../catalog/apps) are validated
  and tracked against upstream by [`tools/catalog`](../tools/catalog/README.md).

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
- **"Too many requests":** the rate limiter kicked in — raise `THROTTLE_LIMIT`
  if legitimate traffic shares one IP.
- **Next.js dev assets 404 after a build:** stop `next dev`, delete
  `apps/web/.next`, then restart the dev server.
