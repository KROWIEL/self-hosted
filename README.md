<div align="center">

# Self-Hosted

**Deploy apps from git, Docker images or Compose onto your own servers.**
An open-source, self-hosted alternative to Heroku, Vercel and Coolify.

[![CI](https://github.com/KROWIEL/self-hosted/actions/workflows/ci.yml/badge.svg)](https://github.com/KROWIEL/self-hosted/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/KROWIEL/self-hosted)](https://github.com/KROWIEL/self-hosted/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Website](https://krowiel.github.io/self-hosted/) · [Install guide](docs/INSTALL.md) · [Releases](https://github.com/KROWIEL/self-hosted/releases) · **English** · [Русский](README.ru.md)

</div>

---

Self-Hosted is a deployment panel you run yourself. Point it at a repository, a
container image or a Compose file, and it builds, runs and serves your app over
HTTPS on servers you own: one VPS, a few machines, or a home lab behind NAT.

Everything is free and open source under the MIT license. There are no paid
tiers, no license keys and no limits on servers, users or apps.

## Features

- **Three ways to deploy**: build from **git** (curated templates, your own
  `Dockerfile`, or Nixpacks auto-detect), run a **container image**, or start a
  **Compose** stack.
- **App catalog**: 250+ one-click apps in 20 categories (Immich, Jellyfin,
  Gitea, Vaultwarden, Ollama…).
- **Managed databases**: PostgreSQL and MySQL per project, with scheduled
  backups, restore, and off-site copies to S3, GCS, Azure Blob or SFTP.
- **Zero-downtime releases**: blue-green deploys gated on a health check, and
  one-click rollback to any previous image.
- **Automatic HTTPS**: Traefik with Let's Encrypt (per-domain or wildcard via
  DNS-01), or upload your own certificate.
- **Many servers, one panel**: a small Go agent on each server, enrolled with a
  single command; reverse tunnels publish servers that have no public IP.
- **Preview environments**: per-branch and per-pull-request previews from
  GitHub and GitLab webhooks.
- **Teams**: multi-tenant projects with CPU/RAM quotas, `OWNER / ADMIN / MEMBER
  / VIEWER` roles, an audit log with CSV/JSON export, and OpenID Connect single
  sign-on.
- **Day-to-day tools**: live build and runtime logs, metrics with history, an
  in-browser terminal, cron jobs inside containers, alerts to webhook, Discord,
  Slack or Telegram, API tokens, outbound email, and white-label branding.
- **Security**: TOTP two-factor authentication, a strict password policy,
  secrets encrypted at rest (AES-256-GCM), TLS-pinned agents, rate limiting.
- **English and Russian UI** out of the box.

## Screenshots

<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="Projects dashboard" width="900" />
</p>

| Project overview | Service and logs |
|---|---|
| ![Project with a service and a database](docs/screenshots/project.png) | ![Service detail with live metrics](docs/screenshots/service-logs.png) |

| Nodes | App catalog |
|---|---|
| ![Nodes with agent and workloads](docs/screenshots/nodes.png) | ![One-click app catalog](docs/screenshots/catalog.png) |

More in [`docs/screenshots/`](docs/screenshots).

## Install on a server

You need a Linux server (Ubuntu 22.04+ or Debian 12+ recommended, 2 GB RAM or
more), a domain whose DNS record points at it, and ports **80**, **443** and
**8443** open. Then run:

```bash
curl -fsSL https://raw.githubusercontent.com/KROWIEL/self-hosted/main/deploy/install.sh | sudo sh
```

The script installs Docker if it is missing, asks for the panel domain and an
email for Let's Encrypt, generates every secret, starts the panel and prints the
administrator password. Open `https://<your domain>`, sign in, then go to
**Nodes → Add remote node** and run the command it shows on the same server:
that installs the agent that builds and runs your apps.

To add another server, prepare it with
`curl -fsSL https://raw.githubusercontent.com/KROWIEL/self-hosted/main/deploy/install.sh | sudo sh -s node`
and enroll it the same way from **Nodes**.

To upgrade, run the install command again; your settings and data are kept.
The full guide, including DNS, wildcard certificates, backups and
troubleshooting, is in [`docs/INSTALL.md`](docs/INSTALL.md).

## Local development

Requires Node.js 24 LTS, Docker with Compose, and Go 1.25+ for the agent.

```bash
git clone https://github.com/KROWIEL/self-hosted.git
cd self-hosted
./start.sh        # Windows: ./start.ps1
```

The launcher creates `.env` from [`.env.example`](.env.example), starts
PostgreSQL and Redis, applies the schema, seeds an admin and runs the API on
`:3001` and the UI on http://localhost:3000. See
[`docs/INSTALL.md`](docs/INSTALL.md#local-development) for the manual steps.

## Documentation

| Guide | What's inside |
|---|---|
| [`docs/INSTALL.md`](docs/INSTALL.md) | Server install, adding servers, configuration, upgrades, backups, local development, troubleshooting |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | How the panel, the agent and Traefik fit together; repository layout; security model |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | What is shipped and what is planned |
| [`CHANGELOG.md`](CHANGELOG.md) | Release notes |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How to build, test and send changes |

## Architecture

- **`apps/control-plane`**: NestJS API (auth, RBAC, deploy orchestration, audit).
- **`apps/web`**: Next.js 14 dashboard.
- **`services/agent`**: Go daemon on each server (builds, containers, health checks, logs, tunnels).
- **`packages/shared`**: TypeScript types shared by the API and the UI.
- **Infrastructure**: PostgreSQL, Redis (BullMQ) and Traefik.

Details in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Contributing

Issues and pull requests are welcome. Read [`CONTRIBUTING.md`](CONTRIBUTING.md)
first; security problems go through [`SECURITY.md`](SECURITY.md), not public
issues.

## License

[MIT](LICENSE). Use it, copy it, change it, sell it or host it for others; just
keep the copyright notice. Most app catalog manifests are derived from Coolify's
Apache-2.0 service templates, see [`NOTICE`](NOTICE).
