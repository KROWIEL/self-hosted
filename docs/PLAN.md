# Self-Hosted PaaS — План проекта

> Панель для деплоя SaaS-проектов из git в Docker. Архитектура — control plane +
> agent, ориентированная на деплой приложений. MVP: Java-бэкенды и
> React/Next.js-фронтенды.

Документ — единый источник контекста. Разделы: архитектурная модель, решения,
архитектура, схема БД, API, пайплайн сборки, фазы, статус скаффолда, конвенции,
открытые вопросы.

---

## 1. Архитектурная модель (control plane + agent)

Система состоит из управляющего слоя и агентов на нодах:

| Компонент | Стек | Роль |
|---|---|---|
| Control plane | Node.js/TS (NestJS) + PostgreSQL + Redis | UI/API, пользователи, права, шаблоны, оркестрация сборок, отдаёт команды нодам |
| Web UI | Next.js + Tailwind | Дашборд, логи, редактор env |
| Agent | Go | Демон на ноде: жизненный цикл Docker-контейнеров, сборка из git, стрим логов, метрики |
| Templates | Dockerfile | Базовые образы и build/run-рецепты на стек (Java/Node…) |

Принципы, заложенные в дизайн:

- **Шаблоны стека (`Template`)** описывают изолированный install-шаг (clone +
  сборка) и рантайм: `installScript`, `runCommand`, `variables`, `docker images`.
- **Go-агент** — производительный и стабильный демон на каждой ноде; файловый
  доступ и операции с контейнерами встроены в агент, а не вынесены в отдельные
  сервисы.
- **Мульти-нода**: control plane управляет несколькими нодами с агентами.

## 2. Ключевые концепции

| Концепция | Значение |
|---|---|
| `Template` | Шаблон стека (Java / Next.js) |
| Install script | Build pipeline: `git clone` (PAT) → сборка в изолированном контейнере |
| Run command | Команда запуска рантайм-контейнера |
| `Service` | Деплой-единица (бэкенд или фронтенд) |
| `Domain` | Хостнейм → роут Traefik + HTTPS |
| Логи | build-логи + runtime-логи |
| `Node` + Go-агент | Сервер с агентом, управляющим контейнерами |
| Git-интеграция | repo + PAT + webhook — основной способ доставки кода |
| Reverse proxy | Traefik + Let's Encrypt |
| Secrets / env | связи сервисов (фронт → бэк, БД) |

## 3. Принятые решения (по ответам пользователя)

1. **Цель:** свой движок с нуля (control plane + agent), не форк существующих
   решений (не Coolify/Dokploy).
2. **Стек панели:** Node.js/TypeScript — **NestJS** (control plane) + **Next.js** (web).
3. **Агент:** **Go**, мульти-нода.
4. **Сборка:** свои **Dockerfile-шаблоны** на стек (Java/Node), билд в изолированном
   install-контейнере.
5. **Размещение:** отдельные серверы с агентом-демоном (мульти-нода).
6. **БД:** PostgreSQL + **Drizzle ORM** (чистый TS, без бинарного движка); очередь сборок — **BullMQ** (Redis).
   > Изначально планировался Prisma, но в окружении недоступен `binaries.prisma.sh`
   > (движок не скачивается). Перешли на Drizzle — он не требует бинарных загрузок.
7. **Reverse proxy:** Traefik + Let's Encrypt.
8. **Нейминг пакетов:** scope `@selfhosted/` (без дефиса), npm workspaces.

## 4. Архитектура и структура монорепо

```
self-hosted/
├── apps/
│   ├── control-plane/     # NestJS: API + оркестрация
│   └── web/               # Next.js + Tailwind: UI
├── services/
│   └── agent/             # Go-демон на ноде
├── packages/
│   └── shared/            # общие TS-типы/DTO
├── templates/             # Dockerfile-шаблоны (java, nextjs)
├── docs/                  # PLAN.md, roadmap.md
└── docker-compose.yml     # postgres, redis, traefik (dev)
```

Модули control-plane: `auth`, `users`, `nodes`, `projects`, `services`,
`templates`, `git`, плюс `common/crypto` (AES-256-GCM) и `db` (Drizzle).

## 5. Схема БД (PostgreSQL / Drizzle ORM)

Таблицы: `users`, `nodes`, `projects`, `git_credentials`, `templates`,
`services`, `env_vars`, `deployments`, `domains`. (Полная схема —
`apps/control-plane/src/db/schema.ts`; миграции — `drizzle-kit`.)

Ключевое — модель `Template`:

- `baseImage` — рантайм-образ;
- `installImage` + `installScript` — изолированный build-шаг (clone + сборка);
- `dockerfilePath` — путь к Dockerfile рантайм-образа;
- `defaultBuildCommand` / `defaultRunCommand` / `defaultPort` / `healthcheckPath`;
- `variables` (JSON) — объявленные переменные с правилами: `{ name, envVariable, defaultValue, description, rules }`.

Секреты (PAT, env-секреты, daemonToken) шифруются AES-256-GCM.

## 6. API control-plane (REST, `/api/v1`, JWT)

```
POST   /auth/login                      GET /auth/me        POST /auth/refresh
GET/POST/DELETE  /nodes  /nodes/:id     GET /nodes/:id/configuration
GET/POST/DELETE  /git-credentials       POST /git-credentials/:id/verify
GET    /templates  /templates/:id
GET/POST  /projects  /projects/:id  DELETE /projects/:id
POST   /projects/:id/services
GET/DELETE  /services/:id
PATCH  /services/:id            (env, лимиты, команды — частично)
POST   /services/:id/start | stop | restart
POST   /services/:id/deploy            GET /services/:id/deployments
GET/PUT  /services/:id/env             PUT /services/:id/domain
WS     /services/:id/logs              WS /deployments/:id/stream   (Фаза 3/5)
```

## 7. API агента (control-plane ↔ agent, HTTPS + bearer/JWT)

```
GET   /healthz
GET   /api/system
POST  /api/servers/:id/build   {repoUrl,branch,patToken,installImage,installScript,dockerfile,buildCommand,imageTag,env}
POST  /api/servers/:id/power   {action: start|stop|restart|kill}
WS    /api/servers/:id/ws      консоль + метрики (Фаза 1)
```

Безопасность: **PAT не хранится на ноде** — передаётся в теле `/build` только на
время сборки (clone в tmpfs, токен через git credential helper в памяти, не
попадает в слои образа).

## 8. Build pipeline (ядро системы)

Поток `POST /services/:id/deploy`:

1. control-plane создаёт `Deployment(QUEUED)`, кладёт job в BullMQ.
2. Worker расшифровывает PAT → `POST /build` на агент → открывает WS на build-лог.
3. Агент: `git clone --branch` в tmpfs → запуск `installScript` в `installImage`
   → `docker build` рантайм-образа (тег `app-<serviceId>:<sha>`) со стримом лога
   → чистка clone и токена.
4. Успех → `DEPLOYING`: агент `docker stop` старого, `docker run` нового (env,
   лимиты, лейблы Traefik).
5. Traefik по лейблам поднимает роут + Let's Encrypt.
6. `Deployment(SUCCESS)`, `Service.status=RUNNING`, сохраняем `currentImage` для rollback.

**Rollback** = `docker run` предыдущего `currentImage` без пересборки.

## 9. Маршрутизация и связи сервисов

- При `docker run` агент вешает лейблы Traefik (`Host(...)`, `tls.certresolver=le`).
- Сервисы одного проекта на ноде — в общей сети `proj-<projectId>`.
- Фронт→бэк: панель прокидывает в env фронта `BACKEND_URL` (внутренний адрес
  контейнера бэка или публичный домен).

## 10. Фазы реализации

- [x] **Фаза 0 — Фундамент**: монорепо, docker-compose (postgres/redis/traefik),
  Prisma-схема, auth (JWT), crypto.
- [x] **Фаза 1 — Агент**: Go-демон, `/api/system`, build, run, power, remove,
  стрим логов контейнера (поверх `docker` CLI). *(WS/метрики — Фаза 4)*
- [~] **Фаза 2 — Шаблоны**: Dockerfile Java/Next.js, seed-шаблоны, CRUD
  templates/projects/services. *(каркас есть)*
- [x] **Фаза 3 — Build pipeline**: git-credentials (шифрование PAT), BullMQ-воркер
  (`DeployWorker`), реальный clone+build на агенте, `docker run` с env/лимитами,
  Traefik-лейблы для доменов. **Проверено E2E:** `deploy → SUCCESS`,
  `service.status=RUNNING`; `stop/start/delete` через агент. *(стрим build-логов
  в UI по WS — Фаза 5)*
- [x] **Фаза 4 — Маршрутизация/наблюдаемость** — **готово**:
  - live-стрим runtime-логов (`GET /services/:id/logs/stream`);
  - live-стрим build-логов через Redis pub/sub
    (`GET /deployments/:id/logs/stream`, воркер публикует чанки);
  - метрики контейнера (`docker stats`) + health (`GET /services/:id/stats`),
    панель на странице сервиса с поллингом;
  - Traefik + HTTPS: общая сеть `selfhosted-edge`, traefik-labels по домену,
    Let's Encrypt (HTTP-01). На Windows локально для routing через Traefik нужно
    отключить Docker Desktop *Enhanced Container Isolation* (прокси сокета режет
    docker-provider Traefik); на Linux-нодах работает из коробки.
- [ ] **Фаза 5 — Веб-панель**: дашборд сервиса, логи по WS, редактор env, формы.
- [ ] **Фаза 6 — Эксплуатация**: auto-deploy по webhook, rollback, бэкапы,
  health checks, GC образов.

## 11. Статус скаффолда (что уже создано)

Создано и **собирается** (`shared` ✓, `control-plane` `nest build` ✓, `web` `next build` ✓, `agent` `go build`+`vet` ✓):

- `apps/control-plane/` — NestJS: `main.ts`, `app.module.ts`, `db` (Drizzle:
  `schema.ts`, `database.module.ts`, `seed.ts`), `drizzle.config.ts`,
  `common/crypto` (AES-256-GCM), модули `auth` (JWT+стратегия+гард), `users`,
  `nodes` (+`agent.client.ts`), `projects`, `services` (+DTO), `templates`, `git`.
- `services/agent/` — Go: `cmd/agent/main.go`, `internal/{config,api,docker,builder}`.
  **Собирается (`go build ./...`) и проходит `go vet`.**
- `templates/` — `java/Dockerfile`, `nextjs/Dockerfile`, `README.md`.
- `packages/shared/src/` — `enums.ts`, `template.ts`, `dto.ts`, `agent.ts`, `index.ts`.
- Корень — `package.json` (workspaces), `tsconfig.base.json`, `docker-compose.yml`,
  `.env.example`, `.gitignore`, `README.md`.
- `docs/` — `roadmap.md`, `PLAN.md` (этот файл).

Toolchain на машине: **Go 1.25 ✓, Docker 29 ✓, Node 24 (установлен в этой сессии) ✓**.

## 12. Конвенции

- **Scope пакетов:** `@selfhosted/` (без дефиса): `@selfhosted/shared`,
  `@selfhosted/control-plane`, `@selfhosted/web`.
- **Менеджер пакетов:** npm workspaces. Зависимость на shared: `"^0.1.0"`.
- **ORM:** Drizzle (`drizzle-orm` + `postgres` драйвер + `drizzle-kit` для миграций).
  Инъекция БД через токен `DRIZZLE` (`src/db/database.module.ts`).
- **Порты (dev):** control-plane `:3001`, web `:3000`, agent `:8443`,
  postgres `:5432`, redis `:6379`, traefik `:80/:443/:8080`.
- **API base:** `http://localhost:3001/api/v1`.
- **Шифрование секретов:** AES-256-GCM, мастер-ключ `ENCRYPTION_KEY` (32 байта base64).

## 13. История блокеров (решены)

1. **Рассинхрон файлов** — в репозитории были остатки прошлого скаффолда с
   конвенцией `@self-hosted/` (дефис, backend `api`, web `:3001`/api `:4000`,
   `shared` без build, `ci.yml` на pnpm). Пересекающиеся файлы конфликтовали.
   **Решено:** всё приведено к `@selfhosted/`, конфликтные файлы перезаписаны.
2. **Prisma engine недоступен** — `prisma generate` не мог скачать движок с
   `binaries.prisma.sh` (`ENOTFOUND`). **Решено:** перешли на **Drizzle ORM**
   (чистый TS, без бинарных загрузок).
3. **`drizzle-kit` не видел `drizzle-orm`** — из-за hoisting kit оказался в корне,
   а orm — локально в `control-plane`. **Решено:** объявили оба пакета в корневом
   `package.json`, npm положил их рядом в корень.
4. **`nest build` не эмитил `dist`** — связка `tsconfig "incremental": true` +
   `deleteOutDir: true`: tsc считал проект актуальным и ничего не эмитил, а dist
   уже удалён. **Решено:** убрали `incremental` из `apps/control-plane/tsconfig.json`.
5. **`/run` возвращал не-JSON** — агент стримил `>> starting container…` перед JSON,
   control-plane падал на `res.json()`. **Решено:** `/run` отдаёт только JSON,
   прогресс пишется в буфер.

Текущее состояние: всё собирается; **деплой-пайплайн проверен end-to-end** на
Docker (clone → build → run → power → remove).

## 14. Ближайшие задачи (Фаза 4/5)

1. ✅ Live-стрим runtime- и build-логов в UI (chunked HTTP + Redis pub/sub).
2. ✅ Подключение контейнеров к сети Traefik + HTTPS (Let's Encrypt).
3. ✅ `GitCredential` + UI: ввод PAT, проверка доступа (`git ls-remote`), выбор
   git-доступа при создании сервиса (приватные репозитории).
4. ✅ Веб-панель: дашборд, деплой, логи, статусы, мультиязычность (RU/EN).
5. ✅ Метрики контейнеров (`docker stats`) и health checks.
6. ✅ Rollback на предыдущий образ (без пересборки) + webhook авто-деплоя
   (`POST /webhooks/services/:id/:token`, HMAC-токен).
7. ✅ Метрики ноды (Docker-уровень: контейнеры, образы, размеры, reclaimable;
   `GET /nodes/:id/system`) на странице «Ноды».
8. ✅ Авто-GC старых образов сервиса после успешного деплоя
   (`POST /servers/:uuid/gc`, оставляет текущий образ).
9. ✅ Интерактивный терминал в контейнер (web-консоль). Полный дуплекс по
   WebSocket: браузер (xterm.js, JWT в `?token`) ⟷ control-plane
   (`/api/v1/services/:id/exec`) ⟷ агент (`/api/servers/:uuid/exec`,
   daemon-токен) ⟷ Docker exec API с TTY внутри контейнера (hijacked stream,
   без host-PTY — одинаково на Linux-нодах и Windows-деве). Можно зайти руками,
   подключиться к базе, посмотреть/поправить данные.

Дальше (Фаза 6, ещё не сделано): бэкапы томов, автоматическая сборка по cron,
аудит-лог действий, метрики хоста (CPU/RAM/диск самой ОС, не только Docker).
```
