# Changelog

All notable changes are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-06

First public release. Self-Hosted is now fully open source under the MIT
license.

### Added

- One-command server install (`deploy/install.sh`) that sets up Docker, the
  panel, PostgreSQL, Redis and Traefik with generated secrets, and upgrades in
  place when re-run. `install.sh node` prepares additional app servers.
- Panel images `ghcr.io/krowiel/self-hosted-api` and
  `ghcr.io/krowiel/self-hosted-web` for `linux/amd64` and `linux/arm64`,
  published on every release together with prebuilt agent and tunnel binaries
  and `SHA256SUMS`.
- New nodes download the build templates from the panel during enrollment, so
  template builds work on remote servers.
- `TRUST_PROXY` setting, so per-IP rate limits see the real client address
  behind Traefik.
- Project website with English and Russian install guides.

### Changed

- Every feature is available to everyone: preview environments, Git App PR
  previews, off-site backups, alerts, metrics history, single sign-on, audit
  export, API tokens, white-label, email, reverse tunnels and service cron.
  There are no limits on nodes or tunnels.
- License changed from Elastic License 2.0 to MIT.
- The web UI calls the API on the same origin by default (`/api/v1`).
- The bootstrap administrator is only created when the database has no users,
  so changing the admin email no longer brings the seeded account back.

### Removed

- License keys, plans, the Billing page and all licensing code. The database
  migration `0023_drop_licensing` drops the old license tables.

[1.0.0]: https://github.com/KROWIEL/self-hosted/releases/tag/v1.0.0
