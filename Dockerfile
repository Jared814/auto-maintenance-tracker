# Stage 1: Dependencies
FROM node:20-slim AS deps
RUN apt-get update && apt-get install -y python3 make g++ gcc
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Runner
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV MALLOC_ARENA_MAX=2
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle-sqlite ./drizzle-sqlite
# Explicitly copy better-sqlite3 native addon compiled for glibc (node:20-slim).
COPY --from=deps /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "--max-old-space-size=384", "server.js"]
