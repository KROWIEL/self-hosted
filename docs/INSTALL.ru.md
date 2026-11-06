# Установка и эксплуатация

[English](INSTALL.md) · **Русский**

Как запустить Self-Hosted на своём сервере, добавить другие серверы, обновлять
панель и работать с ней локально. Устройство системы описано в
[`ARCHITECTURE.md`](ARCHITECTURE.md) (на английском).

- [Из чего состоит установка](#из-чего-состоит-установка)
- [Требования](#требования)
- [Установка панели](#установка-панели)
- [Подключение сервера как ноды](#подключение-сервера-как-ноды)
- [Добавление серверов](#добавление-серверов)
- [Первый деплой](#первый-деплой)
- [Настройка](#настройка)
- [Обновление](#обновление)
- [Бэкапы](#бэкапы)
- [Удаление](#удаление)
- [Локальная разработка](#локальная-разработка)
- [Порты](#порты)
- [Решение проблем](#решение-проблем)

---

## Из чего состоит установка

- **Панель** работает в Docker на одном сервере: API, веб-интерфейс,
  PostgreSQL, Redis и Traefik. Файлы лежат в `/opt/selfhosted`.
- **Агент ноды** работает на каждом сервере, где запускаются приложения (в том
  числе на сервере панели), как systemd-сервис `selfhosted-agent`. Он собирает
  образы, запускает контейнеры и отправляет в панель состояние и метрики.
- **Traefik** на каждом сервере принимает HTTPS и направляет ваши домены в
  контейнеры этого сервера.

## Требования

- Linux-сервер с белым IP. Рекомендуются Ubuntu 22.04+ или Debian 12+; подойдёт
  любой дистрибутив с systemd и Docker. 2 ГБ ОЗУ — минимум для панели и
  нескольких небольших приложений; сборкам нужно больше.
- Домен для панели, например `panel.example.com`, с записью `A` (или `AAAA`) на
  этот сервер. Создайте её до установки: сертификат запрашивается при первом
  запуске.
- Открытые порты: **80** и **443** для HTTP(S) и **8443** для агента (он должен
  быть доступен только с сервера панели).
- Права root (`sudo`). Docker установится сам, если его нет.

## Установка панели

```bash
curl -fsSL https://raw.githubusercontent.com/KROWIEL/self-hosted/main/deploy/install.sh | sudo sh
```

Скрипт:

1. ставит Docker (через `get.docker.com`), если его нет;
2. скачивает `docker-compose.yml` и `traefik.yml` последнего релиза в
   `/opt/selfhosted`;
3. спрашивает домен панели и email для Let's Encrypt;
4. создаёт `/opt/selfhosted/.env` (права `600`) с новыми паролем базы, ключами
   JWT, вебхуков и шифрования и паролем администратора;
5. скачивает образы из GitHub Container Registry и запускает стек;
6. выводит email и пароль администратора.

Ответы можно передать заранее, например при автоматизации:

```bash
curl -fsSL https://raw.githubusercontent.com/KROWIEL/self-hosted/main/deploy/install.sh \
  | sudo PANEL_DOMAIN=panel.example.com ACME_EMAIL=you@example.com sh
```

| Переменная | По умолчанию | Значение |
|---|---|---|
| `PANEL_DOMAIN` | спрашивается | Домен панели |
| `ACME_EMAIL` | спрашивается | Email для Let's Encrypt |
| `ADMIN_EMAIL` | `ACME_EMAIL` | Логин первого администратора |
| `SELFHOSTED_VERSION` | последний релиз | Тег релиза, например `v1.0.0` |
| `INSTALL_DIR` | `/opt/selfhosted` | Где лежат стек и его `.env` |

Откройте `https://<домен панели>` и войдите. Смените пароль администратора в
**Настройках** и включите двухфакторную аутентификацию.

> Не хотите запускать скрипт через пайп? Скачайте
> [`install.sh`](../deploy/install.sh) из релиза, прочитайте и запустите
> `sudo sh install.sh`. К файлам релиза приложен `SHA256SUMS`.

## Подключение сервера как ноды

Сама панель приложения не запускает, это делает агент. На этом же сервере:

1. В панели откройте **Ноды → Добавить удалённую ноду**.
2. Укажите имя и белый IP или домен сервера. Порт агента оставьте `8443`.
3. Скопируйте показанную команду и выполните её на сервере. Она скачает агента
   с вашей панели, установит его как systemd-сервис `selfhosted-agent` и
   подключит по одноразовому токену через TLS.

Через несколько секунд нода станет **Online**. Проверить агента:
`systemctl status selfhosted-agent` и `journalctl -u selfhosted-agent -f`.

## Добавление серверов

Каждому дополнительному серверу нужен свой Traefik, чтобы домены размещённых
на нём приложений обслуживал он сам:

```bash
curl -fsSL https://raw.githubusercontent.com/KROWIEL/self-hosted/main/deploy/install.sh | sudo sh -s node
```

Команда ставит Docker и Traefik в `/opt/selfhosted` (без панели). Затем
добавьте сервер через **Ноды → Добавить удалённую ноду**, как описано выше, с
его собственным IP. DNS-записи приложений на этом сервере направляйте на его IP.

**Серверы без белого IP** (домашняя лаборатория, NAT): используйте раздел
**Публикация** в панели. Он поднимает небольшой релей туннеля на любом дешёвом
VPS с белым IP и пробрасывает с него порты 80/443 на домашний сервер. Команды
установки для обеих сторон панель сгенерирует сама.

## Первый деплой

1. Если репозиторий приватный, добавьте токен в разделе **Git-доступы**.
2. **Проекты → Создать проект**. Вы станете его `OWNER`.
3. В проекте **Создать сервис**: выберите git, образ, Compose или приложение из
   **Каталога приложений** и ноду, на которой он будет работать.
4. Добавьте сервису домен и направьте его DNS-запись на IP ноды.
5. Запустите деплой и смотрите лог сборки. Traefik запросит сертификат при
   первом заходе по HTTPS.

## Настройка

Все настройки лежат в `/opt/selfhosted/.env`. После изменения примените их:
`cd /opt/selfhosted && sudo docker compose up -d`.

| Переменная | Значение |
|---|---|
| `PANEL_DOMAIN` | Домен панели. При смене нужно обновить и DNS |
| `ACME_EMAIL` | Email для Let's Encrypt |
| `POSTGRES_PASSWORD` | Пароль базы панели. После первого запуска не меняйте его, не поменяв в самом PostgreSQL |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Ключи подписи сессий. Смена разлогинит всех |
| `WEBHOOK_SECRET` | Подпись URL деплой-вебхуков. Смена сделает старые URL недействительными |
| `ENCRYPTION_KEY` | Шифрует секреты в базе. **Никогда не меняйте и не теряйте его**: без него зашифрованные данные не прочитать |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Первый администратор; создаётся, только если в базе нет пользователей |
| `ALLOW_OPEN_REGISTRATION` | `1` разрешает регистрацию всем. По умолчанию выключено, приглашайте пользователей |
| `DAEMON_TOKEN_ROTATION_DAYS` | Как часто меняются токены нод (по умолчанию `30`, `0` отключает) |
| `THROTTLE_LIMIT`, `THROTTLE_AUTH_LIMIT` | Лимит запросов в минуту с одного IP, общий и для входа |

Все переменные с пояснениями — в [`.env.example`](../.env.example).

Почта (SMTP), единый вход (OIDC), алерты, хранилища офсайт-бэкапов и
брендирование настраиваются в панели, а не в `.env`.

### Wildcard-сертификаты

По умолчанию каждый домен получает свой сертификат через HTTP-01. Чтобы
получить один сертификат `*.example.com` через DNS-01 в Cloudflare:

1. Создайте API-токен Cloudflare с правом `Zone:DNS:Edit` для зоны.
2. В `/opt/selfhosted/.env` задайте `CLOUDFLARE_DNS_API_TOKEN=<токен>` и
   `ACME_WILDCARD_CERTS=1`, затем `sudo docker compose up -d`.
3. На каждой ноде добавьте в `/etc/selfhosted-agent.env` строку
   `ACME_WILDCARD_CERTS=1`, выполните `sudo systemctl restart selfhosted-agent`
   и передеплойте сервисы.

Подойдут и другие DNS-провайдеры, которые поддерживает Traefik: задайте
`ACME_DNS_PROVIDER` и переменные провайдера в сервисе `traefik`.

### Свои сертификаты

Загрузите PEM-сертификат и ключ в разделе **Сертификаты**. Агент запишет их в
`/var/lib/selfhosted-agent/traefik`, откуда их читает Traefik. После этого
передеплойте сервис.

## Обновление

Запустите команду установки ещё раз:

```bash
curl -fsSL https://raw.githubusercontent.com/KROWIEL/self-hosted/main/deploy/install.sh | sudo sh
```

Она сохранит `.env`, скачает новый релиз и перезапустит контейнеры; миграции
базы применяются при старте. Для конкретной версии задайте
`SELFHOSTED_VERSION=v1.2.3`. Перед обновлением прочитайте
[список изменений](../CHANGELOG.md).

Чтобы обновить агента на сервере, откройте ноду в разделе **Ноды**, нажмите
**Команда установки** и выполните её снова. Подключённый агент сохраняет свою
идентичность; заменяются только бинарник и шаблоны сборки.

## Бэкапы

Managed-базы ваших приложений бэкапятся из панели (страница базы в проекте,
копии — в разделе **Внешние бэкапы**: S3, GCS, Azure Blob или SFTP). Сама панель хранит состояние в
PostgreSQL; бэкапьте его вместе с `.env`:

```bash
cd /opt/selfhosted
sudo docker compose exec -T postgres pg_dump -U selfhosted selfhosted | gzip > panel-$(date +%F).sql.gz
sudo cp .env panel-env.backup        # содержит ENCRYPTION_KEY, храните надёжно
```

Восстановление на новом сервере. Сначала положите старый `.env`, чтобы новая
база создалась с тем же паролем, а ключ шифрования совпал:

```bash
sudo mkdir -p /opt/selfhosted && sudo cp panel-env.backup /opt/selfhosted/.env
curl -fsSL https://raw.githubusercontent.com/KROWIEL/self-hosted/main/deploy/install.sh | sudo sh
cd /opt/selfhosted
sudo docker compose stop api
sudo docker compose exec -T postgres psql -U selfhosted -d postgres \
  -c 'DROP DATABASE selfhosted' -c 'CREATE DATABASE selfhosted'
gunzip -c panel-YYYY-MM-DD.sql.gz | sudo docker compose exec -T postgres psql -U selfhosted selfhosted
sudo docker compose up -d
```

## Удаление

```bash
cd /opt/selfhosted && sudo docker compose down        # с -v удалятся и все данные
sudo systemctl disable --now selfhosted-agent
sudo rm -rf /etc/systemd/system/selfhosted-agent.service /etc/selfhosted-agent.env \
  /usr/local/bin/selfhosted-agent /var/lib/selfhosted-agent /opt/selfhosted-agent
```

Контейнеры задеплоенных приложений продолжат работать; удалите их из панели до
удаления или вручную через `docker ps` и `docker rm -f`.

## Локальная разработка

Нужны Node.js 24 LTS, Docker с Compose и, для агента, Go 1.25+.

Скрипты запуска создают `.env`, ставят зависимости, поднимают PostgreSQL и
Redis, применяют схему, создают администратора и запускают оба dev-сервера:

```bash
./start.sh          # Linux / macOS
./start.ps1         # Windows PowerShell
```

Если PowerShell блокирует скрипты, один раз выполните
`Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.
Флаги для повторного запуска пропускают шаги: `--skip-infra` / `-SkipInfra`,
`--skip-install` / `-SkipInstall`, `--skip-setup` / `-SkipSetup`.

Откройте http://localhost:3000 и войдите с `ADMIN_EMAIL` / `ADMIN_PASSWORD` из
`.env`. Слабый пароль из сида примется один раз, затем панель попросит его
сменить.

Вручную:

```bash
cp .env.example .env                          # затем задайте настоящие секреты
docker compose up -d postgres redis
npm install
npm run build --workspace @selfhosted/shared
npm run db:migrate
npm run db:seed
npm run dev:cp                                # API → http://localhost:3001/api/v1
npm run dev:web                               # UI  → http://localhost:3000
```

**Локальная нода.** С `LOCAL_AGENT_ENABLED=1` и `AGENT_INSECURE_HTTP=1` в
`.env` создайте ноду через **Ноды → Локальный агент** и нажмите **Запустить
агент**; API соберёт и запустит агента через `go`. После изменений в коде
агента нажмите **Остановить агент → Запустить агент**.

**Образы.** `docker build --target api .` и `docker build --target web .`
собирают те же образы, что публикует релиз.

**Тесты.** `npm test --workspace @selfhosted/control-plane` для API,
`go test ./...` в `services/agent` и `npm run catalog:validate` для каталога.

## Порты

| Сервис | Порт | Доступ |
|---|---|---|
| Traefik | `80`, `443` | Публичный |
| Агент ноды | `8443` | С сервера панели |
| API | `3001` (`/api/v1`) | Только через Traefik |
| Веб-интерфейс | `3000` | Только через Traefik |
| PostgreSQL | `5432` | Только внутри |
| Redis | `6379` | Только внутри |

## Решение проблем

- **Панель не открывается или сертификат недействителен.** Проверьте, что
  DNS-запись указывает на сервер и порты 80/443 открыты, затем посмотрите
  `sudo docker compose logs traefik`. Let's Encrypt ограничивает повторные
  неудачные попытки, поэтому сначала исправьте DNS.
- **API постоянно перезапускается.** `sudo docker compose logs api`. Пустой или
  шаблонный секрет в `.env` намеренно останавливает запуск.
- **Нода не выходит в онлайн.** Панель должна достучаться до агента на порт
  8443: проверьте `systemctl status selfhosted-agent`, файрвол
  (`ufw allow 8443/tcp`) и IP или домен, указанный для ноды.
- **Домен приложения не открывается.** Его DNS-запись должна указывать на ноду,
  где работает приложение, а на этой ноде должен быть Traefik
  (`install.sh node`).
- **«Слишком много запросов».** Увеличьте `THROTTLE_LIMIT`, если много
  пользователей сидят за одним IP.
- **После входа перекидывает в Настройки.** Пароль больше не соответствует
  политике; задайте более надёжный.
- **Код 2FA не принимается.** TOTP зависит от времени: проверьте часы на
  телефоне и на сервере.
