# Multi-stage build — compiles TypeScript in a full node image, then ships
# only production deps + compiled JS in a slim, non-root runtime image
# (CONTRACT.md §7.5).

# ---- deps: install ALL deps (incl. dev) once, reused by the build stage ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile TypeScript + generate the Prisma client ----
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build

# ---- prod-deps: install only production deps, in their own layer ----
FROM node:20-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate

# ---- runtime: slim final image, non-root ----
FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production

RUN addgroup -S kifaah && adduser -S kifaah -G kifaah

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY package.json ./
# Non-secret per-environment config (config/*.yaml — see src/lib/appConfig.ts)
# read at runtime relative to process.cwd(), which is WORKDIR /app here.
COPY config ./config

RUN mkdir -p /app/uploads && chown -R kifaah:kifaah /app

USER kifaah

EXPOSE 4000

# Applies pending migrations, then starts the server. Requires DATABASE_URL
# and the rest of the production env vars (see .env.example) to be provided
# by the runtime environment (docker-compose, orchestrator secrets, etc.) —
# nothing sensitive is baked into the image. `prisma` (the CLI, not just
# @prisma/client) is a real production dependency specifically so this works
# without reaching out to the network at container start.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/index.js"]
