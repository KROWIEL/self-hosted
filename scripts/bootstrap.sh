#!/usr/bin/env bash
set -euo pipefail

echo "Installing pnpm dependencies..."
pnpm install

echo "Starting local infra (PostgreSQL + Redis)..."
docker compose -f infra/dev/docker-compose.yml up -d

echo "Generating Prisma client..."
pnpm --filter @self-hosted/api prisma:generate

echo "Applying database schema..."
pnpm --filter @self-hosted/api prisma:push

echo "Bootstrap completed."
