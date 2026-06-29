# Self-Hosted PaaS Panel

A self-hosted control panel for deploying **SaaS projects** from a git repository into Docker. You manage applications instead of game servers: connect a repo, pick a stack, and the panel builds and runs your services in containers.

You install the panel on a server, connect a git repository (with a PAT), pick a stack template, and the panel builds and runs your app in Docker behind a reverse proxy with HTTPS.

**MVP scope:** Java backends (Maven/Gradle) and React/Next.js frontends.

## Architecture

This is a **control plane + agent** design:

| Component | Path | Stack | Role |
|---|---|---|---|
| **Control plane** | `apps/control-plane` | NestJS + Drizzle ORM + PostgreSQL + Redis | API, auth, projects, build orchestration (BullMQ) |
| **Web UI** | `apps/web` | Next.js + Tailwind | Dashboard, logs, env editor |
| **Agent** | `services/agent` | Go + Docker SDK | Runs on each node: build, run, stream logs/metrics |
| **Templates** | `templates/` | Dockerfile | Stack build/run recipes per supported stack |
| **Shared** | `packages/shared` | TypeScript | Shared types/DTOs between control plane and web |

### Core concepts

| Concept | Meaning |
|---|---|
| `Template` | A stack definition (Java / Next.js) describing how to build & run |
| Build pipeline | `git clone` → build in an isolated container → runtime image |
| Run command | Command used to start the runtime container |
| `Service` | A deployable unit — a backend or frontend deployment |
| `Domain` | A hostname routed to a service via Traefik |
| Logs | Build logs + runtime logs |
| Node + Agent | A server running the Go agent that manages containers |

## Prerequisites

- Node.js >= 20 (control plane + web) — **not yet installed on this machine**
- Go >= 1.24 (agent) — installed
- Docker (compose) — installed

## Getting started (local dev)

```bash
# 1. Infrastructure (Postgres, Redis, Traefik)
docker compose up -d

# 2. Env
cp .env.example .env   # then edit secrets

# 3. Install JS deps
npm install

# 4. Build shared types
npm run build --workspace @selfhosted/shared

# 5. Database (Drizzle): push schema + seed
npm run db:push  --workspace @selfhosted/control-plane
npm run db:seed  --workspace @selfhosted/control-plane

# 6. Run control plane and web
npm run dev:cp     # http://localhost:3001
npm run dev:web    # http://localhost:3000

# 7. Build the agent
cd services/agent && go build ./...
```

## Roadmap

- [x] Phase 0 — Monorepo foundation, DB schema, auth
- [ ] Phase 1 — Agent: register, power commands, log streaming
- [ ] Phase 2 — Templates + project/service CRUD
- [ ] Phase 3 — Git integration + build pipeline (BullMQ)
- [ ] Phase 4 — Run + Traefik routing + HTTPS
- [ ] Phase 5 — Web dashboard
- [ ] Phase 6 — Auto-deploy webhooks, rollback, backups

## License

MIT
