# syntax=docker/dockerfile:1.7
#
# Panel images, built from the repository root:
#   docker build --target api -t self-hosted-api .
#   docker build --target web -t self-hosted-web .

# ---- Go: node agent and tunnel relay binaries the panel hands out ----------
FROM --platform=$BUILDPLATFORM golang:1.25-alpine AS go
WORKDIR /src
COPY services/agent/go.mod services/agent/go.sum ./
RUN go mod download
COPY services/agent ./
ARG VERSION=1.0.0
RUN set -e; mkdir -p /out/agent /out/tunnel; \
    for arch in amd64 arm64; do \
      CGO_ENABLED=0 GOOS=linux GOARCH=$arch go build -trimpath \
        -ldflags "-s -w -X github.com/self-hosted/agent/internal/config.Version=$VERSION" \
        -o /out/agent/selfhosted-agent-linux-$arch ./cmd/agent; \
      CGO_ENABLED=0 GOOS=linux GOARCH=$arch go build -trimpath -ldflags "-s -w" \
        -o /out/tunnel/tunnel-server-linux-$arch ./cmd/tunnel-server; \
    done; \
    CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build -trimpath -ldflags "-s -w" \
      -o /out/tunnel/tunnel-server-windows-amd64.exe ./cmd/tunnel-server

# ---- Node: build shared types, API and web ----------------------------------
# The output is plain JS, so this runs natively even for arm64 images; native
# modules for the target come from api-deps below.
FROM --platform=$BUILDPLATFORM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/control-plane/package.json apps/control-plane/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/control-plane apps/control-plane
COPY apps/web apps/web
# The browser talks to the API on the panel's own origin (routed by Traefik).
ENV NEXT_PUBLIC_API_URL=/api/v1 NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @selfhosted/shared \
 && npm run build -w @selfhosted/control-plane \
 && npm run build -w @selfhosted/web

# ---- Production dependencies of the API only --------------------------------
FROM node:24-bookworm-slim AS api-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/control-plane/package.json apps/control-plane/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace @selfhosted/control-plane

# ---- API image ---------------------------------------------------------------
FROM node:24-bookworm-slim AS api
ENV NODE_ENV=production
# git: repository access checks (git ls-remote) when connecting a repo.
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=api-deps /app ./
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/control-plane/dist apps/control-plane/dist
COPY apps/control-plane/drizzle apps/control-plane/drizzle
COPY catalog catalog
COPY templates templates
COPY services/agent-dist/install.sh services/agent-dist/install.sh
COPY services/tunnel-dist services/tunnel-dist
COPY --from=go /out/agent services/agent-dist/dist
COPY --from=go /out/tunnel services/tunnel-dist/dist
RUN tar -czf services/agent-dist/dist/templates.tar.gz templates
WORKDIR /app/apps/control-plane
USER node
EXPOSE 3001
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/db/seed.js && exec node dist/main.js"]

# ---- Web image ---------------------------------------------------------------
FROM node:24-bookworm-slim AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
