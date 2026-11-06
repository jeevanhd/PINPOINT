# syntax=docker/dockerfile:1
#
# One image, three roles: api, worker and web all run from the same build and
# only the command differs. Debian slim (not alpine) because argon2 ships glibc
# prebuilds and Prisma needs openssl - on alpine both would compile from source.

FROM node:20-bookworm-slim AS base
ENV NODE_ENV=development \
    npm_config_update_notifier=false \
    npm_config_fund=false \
    npm_config_audit=false
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Dependency layer: rebuilds only when a manifest or the lockfile changes.
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --include=dev

FROM deps AS build
COPY . .
RUN npx prisma generate --schema apps/api/prisma/schema.prisma

FROM build AS dev
EXPOSE 4000 5173
CMD ["npm", "run", "dev:all"]
