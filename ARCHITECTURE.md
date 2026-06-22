# ARCHITECTURE

## Цель MVP
Дать оператору одну панель на VPS, через которую можно:
- подключить локальную ноду (Linux VM),
- разворачивать приложения из Git,
- публиковать домены наружу через VPS,
- смотреть логи и управлять жизненным циклом приложений.

## Компоненты
- `panel-web` (Next.js): web UI для оператора.
- `api` (NestJS): auth, RBAC, CRUD, deploy orchestration, route sync, audit/logs.
- `node-agent` (Node.js): выполняет команды на локальной ноде.
- `PostgreSQL`: основное хранилище.
- `Redis`: вспомогательный cache/queue слой (расширяемый).
- `Caddy`: edge reverse proxy на VPS.
- `rathole`: tunnel между VPS и локальной нодой.

## Data flow

### 1) Auth и RBAC
1. Пользователь делает login через GitHub OAuth.
2. API проверяет allowlist (`env + user_invites`).
3. Создается/обновляется `users`, назначаются роли, сохраняется сессия.
4. Guards проверяют permissions на каждом защищенном endpoint.

### 2) Enrollment ноды
1. Оператор создает `enrollment token`.
2. Node-agent подключается к `/agent-control` с token.
3. API регистрирует `node`, выдает `nodeToken`.
4. Агент сохраняет credentials локально и далее подключается по ним.

### 3) Deploy
1. Оператор нажимает Deploy.
2. API создает `deploy_job` и отправляет команду агенту по WS.
3. Агент делает `git checkout`, `docker compose build`, `up -d`, healthcheck.
4. Агент отправляет `deploy_progress` + `command_result`.
5. API обновляет `deploy_jobs`/`deploy_revisions`.

### 4) Route sync
1. Оператор создает/обновляет route.
2. API обновляет Caddy через Admin API.
3. API генерирует `rathole server` конфиг + controlled reload.
4. API отправляет `tunnel.sync` команде ноды.
5. Агент генерирует `rathole client` конфиг + reload.

### 5) Logs
1. Агент стримит `log_line` события в API.
2. API сохраняет `app_logs` в PostgreSQL.
3. API ретранслирует live-логи в `/ui-realtime`.
4. Retention job удаляет логи старше 7 дней.

## Безопасность
- Caddy Admin API доступен только локально.
- Секреты в БД хранятся в зашифрованном виде (AES-256-GCM).
- Docker доступ у агента ограничивается allowlist-операциями.
- OAuth доступ только по allowlist.
- Включен аудит критичных действий.

## Ограничения MVP
- single-node, single-VPS, без HA.
- допустим краткий микропростой при reload route/tunnel.
- нет backup/restore в MVP (осознанный риск).
