$ErrorActionPreference = "Stop"

Write-Host "Installing pnpm dependencies..."
pnpm install

Write-Host "Starting local infra (PostgreSQL + Redis)..."
docker compose -f infra/dev/docker-compose.yml up -d

Write-Host "Generating Prisma client..."
pnpm --filter @self-hosted/api prisma:generate

Write-Host "Applying database schema..."
pnpm --filter @self-hosted/api prisma:push

Write-Host "Bootstrap completed."
