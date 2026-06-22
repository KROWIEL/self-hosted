# Runbook: Recovery and incidents

## Типовые инциденты
- Node offline.
- Deploy stuck/failed.
- Route sync failed.
- Caddy/rathole reload errors.
- OAuth login denied unexpectedly.

## Диагностика
1. Проверить `dashboard` и статус нод.
2. Проверить последние `audit-events`.
3. Проверить `deploy_jobs` для активного app.
4. Проверить service logs:
   - API
   - panel-web
   - rathole
   - caddy
   - node-agent

## Runbook: Node offline
1. Проверить доступность ноды по сети.
2. Проверить контейнер node-agent и его логи.
3. Перезапустить node-agent.
4. Если credentials повреждены — повторить enrollment.

## Runbook: Route sync failed
1. Проверить валидность домена и конфликтов bind port.
2. Проверить доступность Caddy Admin API (`127.0.0.1:2019`).
3. Проверить права на `RATHOLE_SERVER_CONFIG_PATH`.
4. Повторить `POST /routes/:id/sync`.

## Runbook: Deploy failed
1. Проверить git credentials и доступ к репозиторию.
2. Проверить `docker compose` на ноде вручную.
3. Проверить healthcheck endpoint.
4. Выполнить rollback из панели.

## Post-incident
- Зафиксировать root cause.
- Добавить regression test.
- Обновить соответствующий runbook.
