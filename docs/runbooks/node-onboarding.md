# Runbook: Node onboarding

## Цель
Подключить локальную Linux VM (node-agent + rathole client) к VPS.

## Предусловия
- VPS часть уже поднята.
- В панели создан enrollment token.
- На ноде установлен Docker.

## Шаги
1. На ноде склонировать репозиторий.
2. Создать `.env` на ноде (или передать env в compose):
   - `API_BASE_URL=http://<vps-ip-or-domain>:4000`
   - `ENROLLMENT_TOKEN=<token-from-panel>`
   - `AGENT_NODE_NAME=<human-readable-name>`
   - `RATHOLE_SERVER_ADDR=<vps-ip>:2333`
   - `CONTROL_CHANNEL_SHARED_SECRET=<shared-secret>`
3. Проверить `infra/node/rathole/client.toml`.
4. Запустить:
   - `docker compose -f infra/node/agent/docker-compose.yml up -d --build`
5. Дождаться enrollment:
   - агент получит `nodeId/nodeToken` и сохранит в state file.
6. Проверить в панели:
   - нода отображается как online.

## Проверка команд
- Нажать `start/stop/restart` для test app.
- Проверить, что command_result приходит в UI.
- Проверить live логи.
