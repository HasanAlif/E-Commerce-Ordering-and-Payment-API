# syntax=docker/dockerfile:1

# ── Stage 1: build ──────────────────────────────────────────
FROM node:22-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
COPY src ./src

RUN npx prisma generate && npm run build

# Production node_modules + the prisma CLI (needed for migrate deploy at boot)
RUN npm prune --omit=dev && npm install --no-save prisma@7.4.2

# ── Stage 2: runtime ────────────────────────────────────────
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# curl for the container healthcheck
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts /app/package.json ./

EXPOSE 5000

# Apply pending migrations, then start the API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
