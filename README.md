# self-hosted

Self-hosted MVP платформа для публикации приложений из локальной Linux VM через VPS с белым IP.

## Что умеет MVP
- GitHub OAuth вход в панель с allowlist политикой.
- Полный RBAC (`admin`, `operator`, `viewer`) и аудит критичных действий.
- Enrollment локальной ноды одноразовым токеном.
- Управление приложениями Docker Compose: CRUD, `start/stop/restart`.
- Ручной deploy из Git и rollback на предыдущий `git ref`.
- Управление доменными маршрутами через Caddy Admin API и rathole.
- Live логи + история за 7 дней в PostgreSQL.
- Realtime события через WebSocket (`agent-control`, `ui-realtime`).

## Структура репозитория
- `apps/api` — NestJS API, RBAC, auth, deploy/routes/logs/audit.
- `apps/panel-web` — Next.js админ-панель.
- `apps/node-agent` — агент на локальной ноде.
- `infra/vps` — compose и конфиги VPS.
- `infra/node` — compose и конфиги локальной ноды.
- `infra/dev` — локальные PostgreSQL/Redis для разработки.
- `scripts` — bootstrap скрипты.

## Быстрый старт (dev)
1. Скопируй `.env.example` в `.env` и заполни OAuth/секреты.
2. Запусти bootstrap:
   - PowerShell: `./scripts/bootstrap.ps1`
   - bash: `./scripts/bootstrap.sh`
3. Запусти приложения:
   - `pnpm dev`

### Минимально необходимые env
- `DATABASE_URL`
- `REDIS_URL`
- `SESSION_SECRET`
- `MASTER_ENCRYPTION_KEY`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL`
- `GITHUB_ALLOWLIST`
- `CADDY_ADMIN_URL`
- `RATHOLE_SERVER_CONFIG_PATH`
- `RATHOLE_RELOAD_COMMAND`

## Команды
- `pnpm bootstrap` — install + локальная infra.
- `pnpm dev` — API + panel + node-agent в dev режиме.
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm smoke`
- `pnpm security`

## CI quality gates
Workflow: `.github/workflows/ci.yml`
- typecheck
- lint
- unit/integration tests
- smoke tests
- dependency security scan

## Документация архитектуры и эксплуатации
- Общая архитектура: `ARCHITECTURE.md`
- VPS runbook: `docs/runbooks/vps-setup.md`
- Node onboarding runbook: `docs/runbooks/node-onboarding.md`
- Ротация master key: `docs/runbooks/master-key-rotation.md`
- Инциденты и восстановление: `docs/runbooks/recovery.md`
