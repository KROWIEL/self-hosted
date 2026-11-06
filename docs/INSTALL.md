# Installation and operations

**English** · [Русский](INSTALL.ru.md)

How to run Self-Hosted on your own server, add more servers, keep it updated,
and work on it locally. For how the pieces fit together see
[`ARCHITECTURE.md`](ARCHITECTURE.md).

- [How it is laid out](#how-it-is-laid-out)
- [Requirements](#requirements)
- [Install the panel](#install-the-panel)
- [Connect the server as a node](#connect-the-server-as-a-node)
- [Add more servers](#add-more-servers)
- [Deploy your first app](#deploy-your-first-app)
- [Configuration](#configuration)
- [Upgrades](#upgrades)
- [Backups](#backups)
- [Uninstall](#uninstall)
- [Local development](#local-development)
- [Ports](#ports)
- [Troubleshooting](#troubleshooting)

---

## How it is laid out

- **The panel** runs in Docker on one server: the API, the web UI,
  PostgreSQL, Redis and Traefik. It lives in `/opt/selfhosted`.
- **The node agent** runs on every server that hosts apps, including the panel
  server itself, as the `selfhosted-agent` systemd service. It builds images,
  runs containers and reports health and metrics back to the panel.
- **Traefik** on each server terminates HTTPS and routes your domains to the
  containers on that server.

## Requirements

- A Linux server with a public IP. Ubuntu 22.04+ or Debian 12+ is recommended;
  any distribution with systemd and Docker works. 2 GB RAM is the minimum for
  the panel plus a few small apps; builds like more.
- A domain for the panel, e.g. `panel.example.com`, with an `A` (or `AAAA`)
  record pointing at the server. Create it before installing, because the
  certificate is requested on first start.
- Open ports: **80** and **443** for HTTP(S), and **8443** for the node agent
  (it only needs to be reachable from the panel server).
- Root access (`sudo`). Docker is installed for you if it is missing.

## Install the panel

```bash
curl -fsSL https://raw.githubusercontent.com/KROWIEL/self-hosted/main/deploy/install.sh | sudo sh
```

The script:

1. installs Docker (via `get.docker.com`) if it is not there;
2. downloads `docker-compose.yml` and `traefik.yml` of the latest release into
   `/opt/selfhosted`;
3. asks for the panel domain and an email for Let's Encrypt;
4. writes `/opt/selfhosted/.env` (mode `600`) with freshly generated database
   password, JWT, webhook and encryption keys and an administrator password;
5. pulls the images from GitHub Container Registry and starts the stack;
6. prints the administrator email and password.

You can answer the questions in advance, for example in automation:

```bash
curl -fsSL https://raw.githubusercontent.com/KROWIEL/self-hosted/main/deploy/install.sh \
  | sudo PANEL_DOMAIN=panel.example.com ACME_EMAIL=you@example.com sh
```

| Variable | Default | Meaning |
|---|---|---|
| `PANEL_DOMAIN` | asked | Domain of the panel |
| `ACME_EMAIL` | asked | Email for Let's Encrypt |
| `ADMIN_EMAIL` | `ACME_EMAIL` | Login of the first administrator |
| `SELFHOSTED_VERSION` | latest release | Release tag to install, e.g. `v1.0.0` |
| `INSTALL_DIR` | `/opt/selfhosted` | Where the stack and its `.env` live |

Open `https://<panel domain>` and sign in. Change the administrator password
under **Settings** and turn on two-factor authentication.

> Prefer not to pipe a script into a shell? Download
> [`install.sh`](../deploy/install.sh) from the release, read it, then run
> `sudo sh install.sh`. Release assets come with a `SHA256SUMS` file.

## Connect the server as a node

The panel does not run apps by itself; the node agent does. On the same server:

1. In the panel open **Nodes → Add remote node**.
2. Enter a name and the server's public IP or domain. Keep agent port `8443`.
3. Copy the command shown and run it on the server. It downloads the agent from
   your panel, installs it as the `selfhosted-agent` systemd service, and
   enrolls it with a one-time token over TLS.

The node turns **Online** within a few seconds. Check the agent with
`systemctl status selfhosted-agent` and `journalctl -u selfhosted-agent -f`.

## Add more servers

Each additional server needs its own Traefik, so domains of apps placed there
are served by that server:

```bash
curl -fsSL https://raw.githubusercontent.com/KROWIEL/self-hosted/main/deploy/install.sh | sudo sh -s node
```

This installs Docker and Traefik into `/opt/selfhosted` (no panel). Then add the
server from **Nodes → Add remote node** exactly as above, using its own IP.
Point the DNS records of apps you deploy there at that server's IP.

**Servers without a public IP** (home lab, NAT): use **Exposure** in the panel.
It sets up a small tunnel relay on any cheap public VPS and forwards ports
80/443 from it to the server at home. The panel generates the install commands
for both sides.

## Deploy your first app

1. If the repository is private, add a token under **Git access**.
2. **Projects → Create project**. You become its `OWNER`.
3. In the project, **Create service**: pick git, image, Compose, or an app from
   the **App catalog**, and the node to run it on.
4. Add a domain to the service and point its DNS record at the node's IP.
5. Deploy and watch the build log. Traefik requests the certificate on the first
   HTTPS visit.

## Configuration

All settings live in `/opt/selfhosted/.env`. After editing it, apply with
`cd /opt/selfhosted && sudo docker compose up -d`.

| Variable | Meaning |
|---|---|
| `PANEL_DOMAIN` | Domain of the panel. Changing it also needs a DNS update |
| `ACME_EMAIL` | Email for Let's Encrypt |
| `POSTGRES_PASSWORD` | Panel database password. Do not change it after the first start without changing it in PostgreSQL too |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Session signing keys. Rotating them signs everyone out |
| `WEBHOOK_SECRET` | Signs deploy webhook URLs. Rotating it invalidates existing webhook URLs |
| `ENCRYPTION_KEY` | Encrypts secrets at rest. **Never change or lose it**: encrypted data cannot be read without it |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | First administrator, created only when the database has no users |
| `ALLOW_OPEN_REGISTRATION` | `1` lets anyone register. Off by default; invite users instead |
| `DAEMON_TOKEN_ROTATION_DAYS` | How often node tokens rotate (default `30`, `0` disables) |
| `THROTTLE_LIMIT`, `THROTTLE_AUTH_LIMIT` | Requests per minute per IP, overall and for sign-in |

The annotated [`.env.example`](../.env.example) lists every variable.

Mail (SMTP), single sign-on (OIDC), alerts, off-site backup targets and
branding are configured in the panel, not in `.env`.

### Wildcard certificates

By default each domain gets its own certificate over HTTP-01. For one
`*.example.com` certificate through DNS-01 with Cloudflare:

1. Create a Cloudflare API token with `Zone:DNS:Edit` for the zone.
2. In `/opt/selfhosted/.env` set `CLOUDFLARE_DNS_API_TOKEN=<token>` and
   `ACME_WILDCARD_CERTS=1`, then `sudo docker compose up -d`.
3. In `/etc/selfhosted-agent.env` on each node add `ACME_WILDCARD_CERTS=1`, then
   `sudo systemctl restart selfhosted-agent` and redeploy the services.

Other DNS providers supported by Traefik work too: set `ACME_DNS_PROVIDER` and
that provider's variables in the `traefik` service.

### Custom certificates

Upload a PEM certificate and key under **Certificates**. The agent writes them
to `/var/lib/selfhosted-agent/traefik`, which Traefik reads. Redeploy the
service afterwards.

## Upgrades

Run the install command again:

```bash
curl -fsSL https://raw.githubusercontent.com/KROWIEL/self-hosted/main/deploy/install.sh | sudo sh
```

It keeps `.env`, pulls the new release and restarts the containers; database
migrations run on start. To install a specific version, set
`SELFHOSTED_VERSION=v1.2.3`. Read the [changelog](../CHANGELOG.md) first.

To update the agent on a server, open the node in **Nodes**, press **Install
command** and run the command again. An enrolled agent keeps its identity; only
the binary and build templates are replaced.

## Backups

Managed databases of your apps are backed up from the panel (the database page
in a project, with copies under **Offsite backups**: S3, GCS, Azure Blob or SFTP). The panel itself keeps its state in
PostgreSQL; back it up together with `.env`:

```bash
cd /opt/selfhosted
sudo docker compose exec -T postgres pg_dump -U selfhosted selfhosted | gzip > panel-$(date +%F).sql.gz
sudo cp .env panel-env.backup        # holds ENCRYPTION_KEY; store it safely
```

Restore on a new server. Put the old `.env` in place first, so the new database
is created with the same password and the encryption key matches:

```bash
sudo mkdir -p /opt/selfhosted && sudo cp panel-env.backup /opt/selfhosted/.env
curl -fsSL https://raw.githubusercontent.com/KROWIEL/self-hosted/main/deploy/install.sh | sudo sh
cd /opt/selfhosted
sudo docker compose stop api
sudo docker compose exec -T postgres psql -U selfhosted -d postgres \
  -c 'DROP DATABASE selfhosted' -c 'CREATE DATABASE selfhosted'
gunzip -c panel-YYYY-MM-DD.sql.gz | sudo docker compose exec -T postgres psql -U selfhosted selfhosted
sudo docker compose up -d
```

## Uninstall

```bash
cd /opt/selfhosted && sudo docker compose down        # add -v to delete all data
sudo systemctl disable --now selfhosted-agent
sudo rm -rf /etc/systemd/system/selfhosted-agent.service /etc/selfhosted-agent.env \
  /usr/local/bin/selfhosted-agent /var/lib/selfhosted-agent /opt/selfhosted-agent
```

Containers of deployed apps are left running; remove them from the panel before
uninstalling, or with `docker ps` and `docker rm -f`.

## Local development

Requires Node.js 24 LTS, Docker with Compose and, for the agent, Go 1.25+.

The launchers set up `.env`, install dependencies, start PostgreSQL and Redis,
push the schema, seed the admin and run both dev servers:

```bash
./start.sh          # Linux / macOS
./start.ps1         # Windows PowerShell
```

If PowerShell blocks scripts, run
`Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` once.
Re-run flags skip steps: `--skip-infra` / `-SkipInfra`, `--skip-install` /
`-SkipInstall`, `--skip-setup` / `-SkipSetup`.

Open http://localhost:3000 and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`
from `.env`. A weak seeded password is accepted once, then you are asked to
change it.

Manual steps:

```bash
cp .env.example .env                          # then set real secrets
docker compose up -d postgres redis
npm install
npm run build --workspace @selfhosted/shared
npm run db:migrate
npm run db:seed
npm run dev:cp                                # API → http://localhost:3001/api/v1
npm run dev:web                               # UI  → http://localhost:3000
```

**A local node.** With `LOCAL_AGENT_ENABLED=1` and `AGENT_INSECURE_HTTP=1` in
`.env`, create a node with **Nodes → Local agent** and press **Start agent**;
the API builds and runs the agent with `go`. After changing agent code press
**Stop agent → Start agent**.

**Images.** `docker build --target api .` and `docker build --target web .`
build the same images the release publishes.

**Tests.** `npm test --workspace @selfhosted/control-plane` for the API,
`go test ./...` in `services/agent`, and `npm run catalog:validate` for the app
catalog.

## Ports

| Service | Port | Exposed |
|---|---|---|
| Traefik | `80`, `443` | Public |
| Node agent | `8443` | To the panel server |
| API | `3001` (`/api/v1`) | Behind Traefik only |
| Web UI | `3000` | Behind Traefik only |
| PostgreSQL | `5432` | Internal only |
| Redis | `6379` | Internal only |

## Troubleshooting

- **The panel page does not open or the certificate is invalid.** Check that the
  DNS record points at the server and ports 80/443 are open, then read
  `sudo docker compose logs traefik`. Let's Encrypt rate-limits repeated
  failures, so fix DNS before retrying.
- **The API keeps restarting.** `sudo docker compose logs api`. A missing or
  placeholder secret in `.env` stops the start on purpose.
- **A node stays offline.** The panel must reach the agent on port 8443: check
  `systemctl status selfhosted-agent`, the firewall (`ufw allow 8443/tcp`), and
  the IP or domain entered for the node.
- **An app's domain does not open.** Its DNS record must point at the node the
  app runs on, and that node needs Traefik (`install.sh node`).
- **"Too many requests".** Raise `THROTTLE_LIMIT` if many users share one IP.
- **Signed in, but sent to Settings.** Your password no longer meets the policy;
  set a stronger one.
- **2FA code rejected.** TOTP is time-based: check the clock on your phone and
  on the server.
