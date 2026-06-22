# Runbook: VPS setup

## Цель
Поднять control-plane на VPS: API, panel, PostgreSQL, Redis, Caddy, rathole server.

## Предусловия
- Linux VPS (Ubuntu/Debian), белый IP.
- Домен направлен на VPS.
- Docker + Docker Compose установлены.
- Открыты порты `22`, `80`, `443`, `2333`.

## Шаги
1. Клонировать репозиторий и перейти в него.
2. Скопировать `.env.example` в `.env`.
3. Заполнить:
   - OAuth переменные GitHub
   - `SESSION_SECRET`
   - `MASTER_ENCRYPTION_KEY`
   - `DATABASE_URL`
   - `REDIS_URL`
   - `CADDY_ADMIN_URL` (`http://127.0.0.1:2019`)
4. Проверить `infra/vps/caddy/Caddyfile` и `infra/vps/rathole/server.toml`.
5. Запустить:
   - `docker compose -f infra/vps/docker-compose.yml up -d --build`
6. Проверить:
   - `GET /health` на API
   - доступ к panel-web
   - `docker compose ps`

## Post-check
- Вход в панель через GitHub OAuth работает.
- У пользователя есть нужная роль.
- Создание enrollment token доступно.
