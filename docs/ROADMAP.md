# Roadmap

What is already in `main` and what is being worked on next. There are no dates:
this is a spare-time project, and the list is ordered by how useful each item
looks rather than by when it will land.

## Shipped

**Deployments.** Git, container image and Compose services; template,
`Dockerfile` and Nixpacks builds; live build and runtime logs; blue-green
releases gated on a health check; one-click rollback to any previous image;
auto-deploy webhooks; an in-browser terminal into a running container.

**App catalog.** 250+ one-click apps across 20 categories, free on every tier,
with search, category filters and a details view. Manifests are validated in CI
and reconciled against upstream weekly by [`tools/catalog`](../tools/catalog/README.md).

**Data.** Managed PostgreSQL and MySQL per project, scheduled backups and
one-click restore, named volumes for durable service data.

**Nodes.** A Go agent per server with self-enrollment, TLS pinning, heartbeats
and scheduled daemon-token rotation; Docker-level and host-level metrics; a
per-node cleanup action. Reverse tunnels publish nodes that sit behind NAT.

**Access.** Multi-tenant projects with CPU/RAM quotas, four project roles, an
append-only audit log, two-stage registration, TOTP two-factor authentication, a
strict password policy with soft-forced rotation, and per-IP rate limiting.

**Routing.** Traefik with Let's Encrypt (HTTP-01 per subdomain or a DNS-01
wildcard) plus custom PEM upload, encrypted at rest.

**Paid modules.** Preview environments with GitHub/GitLab PR previews, off-site
backups to S3/GCS/Azure/SFTP, alerts over webhook/Discord/Slack/Telegram,
metrics history, OIDC single sign-on, audit export, API tokens, white-label and
outbound email. See [`LICENSING.md`](LICENSING.md).

## Next

- **One-command agent install.** Today you build the Go binary and write your
  own systemd unit; an `install.sh` that drops the binary, unit file and config
  in place would make adding a node a copy-paste step.
- **Published artifacts.** CI cross-compiles the Linux agent but only keeps it
  as a build artifact. Tagged releases with prebuilt binaries, and container
  images for the control plane and web, so the panel itself can be run with
  `docker compose up` instead of from source.
- **Update notifications for installed catalog apps.** The weekly sync already
  spots new upstream versions; surfacing that per installed service is the
  missing half.
- **Placement help for multi-node setups.** Services are pinned to a node you
  choose; suggesting one based on free CPU/RAM would scale better past a
  handful of nodes.

## Not planned

- Kubernetes support. The whole point of the agent is that a single Docker host
  is enough.
- Hosting the panel as a service for others — the [license](../LICENSE)
  explicitly does not allow it, and self-hosting is the product.

Ideas and bug reports are welcome in the issue tracker.
