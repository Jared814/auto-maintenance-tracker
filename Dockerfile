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

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/drizzle-sqlite ./drizzle-sqlite
# Explicitly copy better-sqlite3 native addon — Next.js standalone may not
# include it automatically, and it must match the glibc runtime (node:20-slim).
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
RUN mkdir -p /app/data

# gosu allows the entrypoint to fix volume ownership (root-owned by Railway)
# then cleanly drop privileges to the nextjs user before exec.
RUN apt-get update && apt-get install -y --no-install-recommends gosu && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

# Container starts as root so entrypoint can chown the mounted volume,
# then gosu drops to nextjs for the actual node process.
ENTRYPOINT ["/entrypoint.sh"]
