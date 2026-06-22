FROM node:22-alpine
WORKDIR /app

COPY . .
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN pnpm install --filter @self-hosted/panel-web...
WORKDIR /app/apps/panel-web
RUN pnpm build

EXPOSE 3000
CMD ["pnpm", "start"]
