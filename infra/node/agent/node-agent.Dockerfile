FROM node:22-alpine
WORKDIR /app

COPY . .
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN pnpm install --filter @self-hosted/node-agent...
WORKDIR /app/apps/node-agent
RUN pnpm build

CMD ["node", "dist/main.js"]
