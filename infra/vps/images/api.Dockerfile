FROM node:22-alpine AS base
WORKDIR /app

COPY . .
ENV DATABASE_URL=postgresql://selfhosted:selfhosted@localhost:5432/self_hosted
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
RUN pnpm install --filter @self-hosted/api...
WORKDIR /app/apps/api
RUN pnpm prisma generate
RUN pnpm build

EXPOSE 4000
CMD ["node", "dist/main.js"]
