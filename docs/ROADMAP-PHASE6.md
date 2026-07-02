# Роадмап: Фаза 6+ (эксплуатация и продакшн-готовность)

Детальный план по шести направлениям. Каждый трек описан как набор изменений по
слоям: **БД (Drizzle)** → **агент (Go)** → **control-plane (NestJS)** →
**web (Next.js)**, плюс риски и критерии готовности (DoD).

Текущий стек напоминания: control-plane `:3001` (NestJS + Drizzle/Postgres +
Redis/BullMQ), агент `:8443` (Go, поверх Docker), web `:3000` (Next.js), Traefik
(`selfhosted-edge`), секреты — AES-256-GCM.

## Рекомендуемый порядок и зависимости

```
1. Тома + управляемые БД ──┬─> 2. Бэкапы/восстановление
                           └─> 3. Zero-downtime деплой
4. Удалённые ноды (независим, но даёт TLS/enrollment для 5)
5. Безопасность/мультиарендность (сквозной, опирается на 4)
6. Стабильность/полировка (сквозной, делается кусками по ходу)
```

Логика: состояние (тома/БД) — фундамент, без него бэкапы и «зайти в базу» не
имеют смысла. Дальше — надёжность релизов, затем выход на реальные серверы, затем
многопользовательность и сквозная полировка.

---

## Трек 1 — Постоянные тома + управляемые БД — ✅ готово (MVP)

Реализовано: таблицы `volumes` и `managed_databases`; агент монтирует named-volumes
в сервис и поднимает БД-сайдкары (Postgres/MySQL) в общей сети без публикации порта;
эндпоинты агента `POST/DELETE /api/databases`, `/databases/power`, `/databases/status`,
`DELETE /api/volumes`; модуль `databases` (CRUD + provisioning + раскрытие доступов +
привязка к сервису с авто-инъекцией `DATABASE_URL`/`DB_*`); тома сервиса (CRUD,
монтирование при деплое); UI: раздел «Базы данных» на странице проекта и «Постоянные
тома» на странице сервиса. Дымовой тест жизненного цикла БД (create→ready→remove)
пройден на реальном `postgres:16-alpine`. Требование: DB и сервисы должны быть в одной
сети (`AGENT_NETWORK=selfhosted-edge`), иначе нет DNS по имени контейнера.

**Цель.** Данные переживают редеплой. На проект можно поднять Postgres/MySQL
сайдкаром и автоматически прокинуть `DATABASE_URL` в сервисы. Пользовательские
тома монтируются в контейнер сервиса.

### Модель данных

```ts
export const volumeKindEnum = pgEnum('volume_kind', ['NAMED', 'BIND']);
export const volumes = pgTable('volumes', {
  id: uuid().primaryKey().defaultRandom(),
  serviceId: uuid().references(() => services.id, { onDelete: 'cascade' }),
  name: text().notNull(),              // docker volume name: vol-<id>
  mountPath: text().notNull(),         // /data, /var/lib/...
  kind: volumeKindEnum().default('NAMED'),
  sizeLimitMb: integer(),
  createdAt: timestamp().defaultNow(),
});

export const dbEngineEnum = pgEnum('db_engine', ['POSTGRES', 'MYSQL']);
export const managedDatabases = pgTable('managed_databases', {
  id: uuid().primaryKey().defaultRandom(),
  projectId: uuid().references(() => projects.id, { onDelete: 'cascade' }),
  nodeId: uuid().references(() => nodes.id),
  engine: dbEngineEnum().notNull(),
  version: text().notNull(),           // '16', '8.4'
  containerName: text().notNull(),     // db-<id>
  volumeId: uuid().references(() => volumes.id),
  dbName: text().notNull(),
  username: text().notNull(),
  passwordEnc: text().notNull(),       // AES-256-GCM
  port: integer().notNull(),
  status: serviceStatusEnum().default('CREATED'),
  createdAt: timestamp().defaultNow(),
});
```

### Агент (Go)

- `docker volume create/inspect/rm`; передавать `-v vol-<id>:<mountPath>` в `run`.
- Запуск БД-контейнера: `docker run` официального образа (`postgres:16`,
  `mysql:8.4`) в сеть `selfhosted-edge`, с томом и env (`POSTGRES_PASSWORD`…),
  **без публикации порта наружу** (доступ только внутри сети по имени контейнера).
- Эндпоинты: `POST /api/databases` (create+run), `DELETE /api/databases/{id}`,
  `POST /api/databases/{id}/power`, healthcheck готовности (`pg_isready`/`mysqladmin ping`
  через `docker exec`).
- В `run` сервиса монтировать связанные тома (расширить `runBody`).

### Control-plane (NestJS)

- Модуль `databases`: CRUD, генерация пароля (`randomBytes`), шифрование,
  оркестрация агента. При создании — формировать `DATABASE_URL` и класть как
  **секретную** env-переменную сервиса (через существующий `envVars`).
- Модуль/часть `services`: CRUD томов, привязка к сервису, передача в deploy.
- Кнопка «привязать БД к сервису» → авто-инъекция `DATABASE_URL`, `DB_HOST` и т.д.

### Web

- На странице проекта: раздел «Базы данных» (создать/удалить/статус, показать
  внутренний хост и подсказку «подключиться можно из веб-консоли сервиса»).
- На странице сервиса: раздел «Тома» (mountPath, размер) + выбор привязанной БД.
- Связка с уже готовой веб-консолью: из терминала контейнера сразу доступен
  `psql $DATABASE_URL` / `mysql` (закрывает прошлый запрос «подключиться к базе»).

### Риски

- Удаление сервиса не должно молча сносить тома с данными — спрашивать
  подтверждение и предлагать «keep volumes».
- На Windows-деве bind-mount пути отличаются; для named volumes проблем нет.

### DoD

Создал БД на проект → она поднялась в сети → у сервиса появился `DATABASE_URL` →
из веб-консоли `psql` коннектится → редеплой сервиса не теряет данные БД и тома.

---

## Трек 2 — Бэкапы и восстановление — ✅ готово (MVP)

Реализовано: таблицы `backups` и `backup_schedules` (+ enum `backup_kind`,
`backup_status`); агент создаёт снапшоты тома (`tar.gz` через эфемерный
`alpine`-контейнер с bind-mount `AGENT_BACKUP_DIR`) и БД (`pg_dump`/`mysqldump`
→ `gzip` через `docker exec`), умеет восстанавливать (для тома — очистка + распаковка,
для БД — `gunzip | psql`/`mysql` через stdin), отдавать файл на скачивание и удалять;
эндпоинты агента `POST /api/backups`, `POST /api/backups/restore`,
`GET /api/backups/download`, `DELETE /api/backups`; модуль control-plane `backups`
(CRUD + восстановление + проксирование скачивания + retention `keepLast`); расписания
на BullMQ repeatable-jobs (`BackupScheduler` пересобирает repeatable-набор из БД при
изменениях и на старте); UI: общий компонент `BackupsPanel` (список копий со статусом/
размером/датой, «создать копию», скачать, восстановить, удалить + расписания cron с
`keepLast`) подключён к карточке БД (страница проекта) и к каждому тому (страница
сервиса). Дымовой тест БД-цикла (seed→backup→drop→restore) пройден на реальном
`postgres:16-alpine` — данные восстановлены (`x=42`).

**Цель.** Снапшоты томов и управляемых БД: вручную, по расписанию, скачать,
восстановить из UI.

### Модель данных

```ts
export const backupKindEnum = pgEnum('backup_kind', ['VOLUME', 'DATABASE']);
export const backupStatusEnum = pgEnum('backup_status',
  ['RUNNING', 'SUCCESS', 'FAILED']);
export const backups = pgTable('backups', {
  id: uuid().primaryKey().defaultRandom(),
  kind: backupKindEnum().notNull(),
  refId: uuid().notNull(),             // volumeId | managedDatabaseId
  nodeId: uuid().references(() => nodes.id),
  fileName: text().notNull(),          // backup-<id>.tar.gz / .sql.gz
  sizeBytes: integer(),
  status: backupStatusEnum().default('RUNNING'),
  errorMsg: text(),
  createdAt: timestamp().defaultNow(),
});

export const backupSchedules = pgTable('backup_schedules', {
  id: uuid().primaryKey().defaultRandom(),
  kind: backupKindEnum().notNull(),
  refId: uuid().notNull(),
  cron: text().notNull(),              // '0 3 * * *'
  keepLast: integer().default(7),
  enabled: boolean().default(true),
});
```

### Агент (Go)

- Бэкап тома: `docker run --rm -v vol:/data -v <backupDir>:/out alpine tar czf /out/<file> -C /data .`
- Бэкап БД: `docker exec` → `pg_dump`/`mysqldump` → gzip в `<backupDir>`.
- Restore — обратные операции (с остановкой/recreate контейнера БД при необходимости).
- Эндпоинты: `POST /api/backups`, `POST /api/backups/{id}/restore`,
  `GET /api/backups/{id}/download` (stream tar/sql), `DELETE`.
- Хранилище — каталог на ноде (`AGENT_BACKUP_DIR`); опционально S3 (отдельная подзадача).

### Control-plane (NestJS)

- Модуль `backups`: CRUD, проксирование download-стрима (как уже сделано для логов).
- BullMQ: `repeatable jobs` из `backupSchedules` (cron), ретеншн `keepLast`.
- Restore с подтверждением и блокировкой повторного запуска на тот же ref.

### Web

- На страницах БД/сервиса: «Бэкапы» (список, «создать сейчас», скачать,
  восстановить с confirm, расписание cron + keepLast).

### Риски

- Restore деструктивен → двойное подтверждение + бейдж «данные будут перезаписаны».
- Большие дампы → стримить, не держать в памяти; ограничить параллельность.

### DoD

Сделал бэкап БД → скачал файл → удалил пару строк → restore → данные вернулись.
Расписание создаёт бэкап ночью и чистит старше `keepLast`.

---

## Трек 3 — Zero-downtime деплой (blue-green + health-gated) ✅ MVP

**Цель.** Новый контейнер поднимается рядом, проходит healthcheck, только потом
Traefik переключается на него; старый гасится. При провале health — авто-rollback.

**Реализовано.**

- Схема `services`: `zeroDowntime`, `activeColor` (`blue`/`green`),
  `healthcheckPath` (override), `healthTimeoutS`.
- Агент: `run` принимает `color` → контейнер `svc-<id>-<color>`; router/service в
  Traefik цвето-независимый (`svc-<id>`) + LB-healthcheck-лейблы → плавный overlap;
  эндпоинты `POST /health` (HTTP-проба цвета изнутри сети через эфемерный curl) и
  `POST /promote` (снять все инстансы кроме активного цвета); `DELETE ?color=` для
  очистки; stats/logs/power/exec резолвят активный цвет автоматически.
- Control-plane `DeployWorker`: build → run нового цвета → health-gate (поллинг до
  `healthTimeoutS`) → promote (switchover) → GC. При фейле health — снос нового
  цвета, старый остаётся жив, deployment=FAILED. Все стадии пишутся в build-log.
- Web: тумблер «Zero-downtime» + `healthcheckPath`/timeout в настройках сервиса,
  показ активного цвета.

**TODO (доводка).** Блокировка ZDD для stateful (RW-том/эксклюзивная БД);
отдельная визуализация стадий в карточке деплоя; тест на Linux-ноде.

### Модель данных

- `services`: добавить `activeColor` (`blue`/`green`), `healthcheckPath` уже есть в
  templates — продублировать override на сервис: `healthcheckPath`, `healthTimeoutS`.
- Деплой уже хранит `imageTag` — этого достаточно для отката.

### Агент (Go)

- `run` умеет принимать `instanceName` (`svc-<id>-blue`/`-green`) и **не** трогать
  активный контейнер.
- Новый эндпоинт `POST /api/servers/{uuid}/health` — поллинг готовности нового
  инстанса (HTTP GET внутри сети на `healthcheckPath`, либо docker healthcheck status).
- Переключение: обновить Traefik-лейблы (router → новый сервис-контейнер) —
  т.к. лейблы на контейнере, фактически «переключение» = поднять новый с нужным
  router-именем и снять с старого; делать атомарно.

### Control-plane (NestJS)

- `DeployWorker`: новый сценарий — build → run нового цвета → health-gate (ждать
  `SUCCESS` до `healthTimeoutS`) → переключить роутер → остановить старый →
  GC. При фейле health — снести новый, оставить старый, deployment=FAILED.
- Конфиг-флаг на сервис: `zeroDowntime: boolean` (иначе старое поведение).

### Web

- В настройках сервиса тумблер «Zero-downtime» + `healthcheckPath`/timeout.
- В карточке деплоя — стадии (build → health → switchover) и причина авто-отката.

### Риски

- Stateful-сервис с одним томом не любит два инстанса одновременно → блокировать
  zero-downtime, если у сервиса есть RW-том/привязанная эксклюзивная БД (или
  предупреждать).
- На Windows-деве Traefik-роутинг ограничен (ECI) — тестировать на Linux-ноде.

### DoD

Деплой с включённым zero-downtime не даёт даунтайма (curl в цикле без 502); при
заведомо падающем healthcheck — остаётся старая версия, deployment=FAILED.

---

## Трек 4 — Реальные удалённые ноды

**Цель.** Поставить агент на чужой сервер (VPS) по-настоящему: установочный
скрипт, безопасный enrollment, TLS (wss/https), без dev-спавна процесса.

### Модель данных

```ts
export const nodeEnrollments = pgTable('node_enrollments', {
  id: uuid().primaryKey().defaultRandom(),
  nodeId: uuid().references(() => nodes.id, { onDelete: 'cascade' }),
  tokenHash: text().notNull(),        // одноразовый join-token (хэш)
  expiresAt: timestamp().notNull(),
  usedAt: timestamp(),
});
// nodes: + tlsFingerprint text(), agentVersion text(), lastSeenAt timestamp()
```

### Агент (Go)

- Запуск как сервис: `install.sh` (Linux) → ставит бинарь в `/usr/local/bin`,
  создаёт `systemd` unit (`agent.service`), кладёт конфиг с `AGENT_DAEMON_TOKEN`.
- TLS: слушать https (self-signed при старте, отдавать fingerprint), либо за
  Traefik. Control-plane проверяет pinned fingerprint (поле `nodes.tlsFingerprint`).
- `GET /api/version`, периодический heartbeat (`lastSeenAt`).
- Сборка под Linux: `GOOS=linux GOARCH=amd64` в CI, публиковать артефакт.

### Control-plane (NestJS)

- `nodes`: генерация одноразового join-token, эндпоинт enrollment
  (`POST /nodes/{id}/enroll`), отметка `usedAt`, сохранение fingerprint.
- Перевести `AgentClient` на проверку pinned TLS fingerprint при https.
- `agent-runner` (dev-спавн) оставить строго за `LOCAL_AGENT_ENABLED=1`.
- Health/heartbeat → авто-`ONLINE/OFFLINE` в `nodes.status`.

### Web

- На странице «Ноды»: «Добавить ноду» → показать одну curl-команду установки с
  join-token; индикатор online/offline + версия агента + lastSeen.

### Риски

- Безопасность enrollment: токен одноразовый, короткоживущий; не логировать.
- Совместимость версий агент/CP → выводить предупреждение при рассинхроне.

### DoD

На чистом Linux-VPS одной командой поднялся агент (systemd), нода стала ONLINE по
wss с pinned-fingerprint, на неё успешно задеплоился сервис.

---

## Трек 5 — Безопасность и мультиарендность

**Цель.** Несколько пользователей/команд, RBAC по проектам, аудит действий,
метрики хоста (ОС, а не только Docker).

### Модель данных

```ts
export const memberRoleEnum = pgEnum('member_role', ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);
export const projectMembers = pgTable('project_members', {
  id: uuid().primaryKey().defaultRandom(),
  projectId: uuid().references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid().references(() => users.id, { onDelete: 'cascade' }),
  role: memberRoleEnum().notNull().default('MEMBER'),
}, (t) => ({ uniq: unique().on(t.projectId, t.userId) }));

export const auditLogs = pgTable('audit_logs', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid().references(() => users.id),
  action: text().notNull(),           // 'service.deploy', 'db.delete', 'exec.open'
  targetType: text().notNull(),
  targetId: text(),
  meta: jsonb().default(sql`'{}'::jsonb`),
  ip: text(),
  createdAt: timestamp().defaultNow(),
});
```

### Control-plane (NestJS)

- Guard/Policy: проверка членства+роли на каждый ресурс проекта (декоратор
  `@RequireRole('ADMIN')` + извлечение projectId из сущности).
- Interceptor аудита: писать `auditLogs` на мутациях (deploy, power, delete,
  rollback, exec-open, env-change, db/backup ops).
- Эндпоинты управления участниками проекта (invite по email, смена роли).
- **Особо отметить:** ограничить веб-консоль (exec) и просмотр секретов ролью.

### Агент (Go)

- `GET /api/host` — метрики ОС: CPU load, RAM, диск (`/proc`, `gopsutil` или
  парсинг). Уже есть Docker-уровень в `/system`; добавить host-уровень.

### Web

- Страница «Команда»/участники проекта; столбец роли; кнопки только по правам.
- Журнал аудита (фильтры по пользователю/действию/дате).
- На «Ноды»: графики/числа host-метрик (CPU/RAM/диск ОС).

### Риски

- Не сломать одиночный сценарий (один админ) — дефолтные роли и миграция:
  владелец проекта → OWNER.
- Аудит не должен писать секреты в `meta`.

### DoD

VIEWER не видит секреты и не может деплоить; все мутации попадают в аудит;
на странице ноды видны CPU/RAM/диск хоста.

---

## Трек 6 — Стабильность и полировка (сквозной)

**Цель.** Меньше острых углов в уже готовом, базовое тестовое покрытие, CI.

### Задачи

- **Терминал (exec):** авто-reconnect при обрыве WS (backoff), индикатор
  «переподключение», очистка сессии docker-exec при закрытии вкладки
  (heartbeat/ping-pong на WS, закрывать exec при таймауте).
- **Логи (runtime/build):** авто-reconnect стрима, кнопка «очистить», автоскролл
  с «прилипанием» к низу, ограничение буфера.
- **Ошибки API:** единый формат, человекочитаемые сообщения в UI, тосты вместо
  «голых» статус-кодов.
- **Идемпотентность деплоя:** защита от двойного клика/гонок (lock на сервис в
  Redis на время деплоя).
- **Тесты:** unit на `crypto`, `services.service`, deploy-воркер (моки агента);
  Go-тесты на `builder.resolveDockerfile`, exec-парсер resize; e2e smoke на
  deploy через тестовую ноду.
- **CI:** GitHub Actions — `lint + typecheck + build` для control-plane/web,
  `go build/vet/test` для агента, кросс-сборка Linux-бинаря агента как артефакт.
- **Конфиг-валидация:** проверка обязательных env при старте control-plane
  (`ENCRYPTION_KEY` 32 байта, `JWT_SECRET` задан и т.д.) с понятной ошибкой.
- **Graceful shutdown:** корректно закрывать WS-сессии и BullMQ-воркеры.

### DoD

Терминал/логи переживают кратковременный обрыв; повторный клик «Deploy» не плодит
гонок; CI зелёный на PR; есть кросс-собранный Linux-бинарь агента в артефактах.

---

## Трек 4b — Публикация через reverse-tunnel — ✅ готово (MVP)

Облегчённая альтернатива полному Треку 4: панель + Traefik + приложения остаются
на одной (домашней / серый IP) машине, а публичный VDS превращается в **тупой
реле**. Топология: домашний tunnel-CLIENT дозванивается ИСХОДЯЩИМ TLS-соединением
до публичного tunnel-SERVER (NAT/серый IP не мешает); сервер слушает публичные
порты (по умолчанию 443) и через один мультиплексированный канал (yamux)
перекидывает каждое входящее соединение клиенту, который пайпит его в локальный
Traefik. VDS не знает про домены/приложения — добавление нового сервиса не требует
правок на VDS (L4-passthrough 443 → локальный Traefik, TLS терминируется дома,
для сертификатов рекомендуется DNS-01).

Реализовано:

- **Ядро (Go, `services/agent/internal/tunnel`)**: протокол (`Hello`/`HelloAck` +
  length-prefixed заголовок потока с портом и адресом клиента), `Server`
  (TLS-контрол, публичные слушатели, `OpenStream` на каждое соединение),
  `Client` (dial-out, авто-reconnect с backoff, опц. PROXY-protocol v1 для
  сохранения IP клиента, опц. пиннинг отпечатка сертификата), эфемерный
  self-signed cert. Логи yamux заглушены.
- **Бинарники**: `cmd/tunnel-server` (для VDS, ~5 МБ, без Docker-зависимостей) и
  `cmd/tunnel-client` (домашняя сторона). Дымовой тест: HTTP через туннель доходит
  до локального таргета, переподключение работает, неверный токен отклоняется.
- **Дистрибуция (`services/tunnel-dist`)**: кросс-сборка `build.ps1`/`build.sh`
  (linux amd64/arm64, windows amd64), установщики `install.sh` (systemd,
  `CAP_NET_BIND_SERVICE`, `DynamicUser`) и `install.ps1` (scheduled task от SYSTEM).
- **Control-plane (`modules/tunnels`)**: таблица `tunnels` (токен шифруется
  AES-256-GCM), CRUD, генерация токена, запуск/остановка домашнего клиента как
  локального процесса (как у агента, gate `LOCAL_AGENT_ENABLED=1`), статус
  (online/offline по логам клиента), эндпоинт `install` с готовыми командами для
  Linux/Windows, публичная (без auth) отдача бинаря (`/tunnels/bin/:platform`,
  сборка по требованию) и установочных скриптов.
- **Web**: страница «Публикация» (`/tunnels`) — создание туннеля, статус с
  поллингом, старт/стоп, модалка «Настроить VDS» с copy-paste командами и токеном,
  подсказка про DNS/TLS. Пункт навигации + i18n (RU/EN).

Осталось на потом: стабильный пиннинг отпечатка (сейчас ephemeral cert + токен),
запуск домашнего клиента как настоящего сервиса в проде (не только spawn из API),
health-метрики канала, авто-старт включённых туннелей при рестарте control-plane.

---

## Сводная таблица объёма (грубо)

| Трек | БД | Агент | Control-plane | Web | Приоритет |
|------|----|-------|---------------|-----|-----------|
| 1. Тома + БД        | ++ | ++ | ++ | ++ | высокий |
| 2. Бэкапы           | +  | ++ | ++ | +  | высокий |
| 3. Zero-downtime    | +  | +  | ++ | +  | средний |
| 4. Удалённые ноды   | +  | ++ | +  | +  | средний |
| 5. Безопасность     | ++ | +  | ++ | ++ | средний |
| 6. Полировка        | -  | +  | +  | ++ | сквозной |

Предлагаю стартовать с **Трека 1** (даёт максимум пользы и закрывает контекст
прошлых задач про БД/консоль), параллельно подбирая мелочи из **Трека 6**.
