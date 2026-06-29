# Дорожная карта (MVP)

Архитектура: **control plane + agent**, ориентированная на деплой приложений из
git (Java backend + React/Next.js frontend).

## Ключевые концепции

| Концепция | Значение |
|---|---|
| `Template` | Шаблон стека (Java / Next.js) |
| `Template.installScript` | build после clone |
| `Template.runCommand` | команда запуска |
| `Template.variables` | объявленные переменные |
| `Service` | деплой-единица (backend/frontend контейнер) |
| `Domain` | роут + HTTPS через Traefik |
| `Node` + Go-агент | сервер с агентом, управляющим контейнерами |
| Логи | build- и runtime-логи |
| Git-интеграция | repo + PAT — основной способ доставки кода |

## Фазы

- [x] **Фаза 0 — Фундамент**: монорепо, docker-compose (postgres/redis/traefik), Prisma-схема, auth.
- [~] **Фаза 1 — Агент**: Go-демон, `/api/system`, power-команды, build, стрим логов. *(каркас готов; нужны метрики и WS)*
- [~] **Фаза 2 — Шаблоны**: Dockerfile Java/Next.js, seed-шаблоны, CRUD templates/projects/services. *(каркас готов)*
- [ ] **Фаза 3 — Build pipeline**: git-credentials (шифрование PAT), BullMQ-очередь, стрим build-логов в UI.
- [ ] **Фаза 4 — Запуск + маршрутизация**: `docker run` с env/лимитами, Traefik-лейблы, домены, HTTPS.
- [ ] **Фаза 5 — Веб-панель**: дашборд сервиса, логи по WS, редактор env.
- [ ] **Фаза 6 — Эксплуатация**: auto-deploy по webhook, rollback, бэкапы, health checks, GC образов.

## Что уже заскаффолжено

- `apps/control-plane` — NestJS: auth (JWT), prisma, crypto (AES-256-GCM), модули nodes/projects/templates/services, agent-client, deploy-оркестрация (прямой вызов агента; позже → BullMQ).
- `apps/web` — Next.js + Tailwind: страницы home/login/dashboard, api-клиент.
- `services/agent` — Go: HTTP API (`/api/system`, `/build`, `/power`, `/logs`), builder (git clone + docker build), docker-обёртка. **Компилируется.**
- `templates/` — Dockerfile Java и Next.js.
- `packages/shared` — общие TS-типы.

## Ближайшие задачи (Фаза 3)

1. `GitCredential` CRUD + endpoint проверки доступа к репо.
2. BullMQ-воркер: вынести `deploy()` из синхронного вызова в очередь.
3. WebSocket-гейтвей в control-plane для стрима build/runtime логов в UI.
4. Прокидывание env (включая дешифрованные секреты) в `docker run` на агенте.
5. Traefik-лейблы при запуске контейнера + привязка домена.
