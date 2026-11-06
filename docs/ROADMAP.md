# Roadmap

What is already in `main` and what is being worked on next. There are no dates:
this is a spare-time project, and the list is ordered by how useful each item
looks rather than by when it will land. Everything listed is, and will stay,
free and MIT-licensed.

## Shipped

**Deployments.** Git, container image and Compose services; template,
`Dockerfile` and Nixpacks builds; live build and runtime logs; blue-green
releases gated on a health check; one-click rollback to any previous image;
auto-deploy webhooks; an in-browser terminal into a running container; cron jobs
inside service containers.

**Previews.** Disposable branch environments with TTL cleanup, created and
updated from GitHub and GitLab pull request webhooks.

**App catalog.** 250+ one-click apps across 20 categories, with search, category
filters and a details view. Manifests are validated in CI and reconciled against
upstream weekly by [`tools/catalog`](../tools/catalog/README.md).

**Data.** Managed PostgreSQL and MySQL per project, scheduled backups and
one-click restore, off-site copies to S3, GCS, Azure Blob or SFTP, and named
volumes for durable service data.

**Nodes.** A Go agent per server, installed with one command, with
self-enrollment, TLS pinning, heartbeats and scheduled daemon-token rotation;
Docker-level and host-level metrics with history; a per-node cleanup action.
Reverse tunnels publish nodes that sit behind NAT.

**Access.** Multi-tenant projects with CPU/RAM quotas, four project roles, an
audit log with CSV/JSON export, two-stage registration, TOTP two-factor
authentication, OpenID Connect single sign-on, personal API tokens, a strict
password policy with soft-forced rotation, and per-IP rate limiting.

**Operations.** Alerts over webhook, Discord, Slack and Telegram; outbound email
over your own SMTP; white-label branding.

**Routing.** Traefik with Let's Encrypt (HTTP-01 per subdomain or a DNS-01
wildcard) plus custom PEM upload, encrypted at rest.

**Distribution.** Panel images on GHCR, prebuilt agent and tunnel binaries on
every release, and a one-command server installer.

## Next

- **Agent self-update.** Today an agent is updated by re-running its install
  command; the panel could push the new binary to nodes after an upgrade.
- **Update notifications for installed catalog apps.** The weekly sync already
  spots new upstream versions; surfacing that per installed service is the
  missing half.
- **Placement help for multi-node setups.** Services are pinned to a node you
  choose; suggesting one based on free CPU/RAM would scale better past a
  handful of nodes.
- **A command-line client** on top of the API tokens.

## Not planned

- Kubernetes support. The whole point of the agent is that a single Docker host
  is enough.

Ideas and bug reports are welcome in the issue tracker.
