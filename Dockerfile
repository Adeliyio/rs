# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# node:20-alpine ships an old bundled corepack that crashes fetching modern pnpm
# (ERR_UNKNOWN_BUILTIN_MODULE). Install a current corepack first, then activate
# the exact pnpm version pinned in package.json's `packageManager` field (copied
# above so corepack can read it).
RUN npm install -g corepack@latest && corepack enable && corepack prepare --activate
RUN pnpm install --frozen-lockfile

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN npm install -g corepack@latest && corepack enable && corepack prepare --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=1
RUN pnpm build

# Bundle the worker entrypoint for production (tsx is dev-only).
# Uses esbuild (already a pnpm dep via tsx) to produce a single CJS file
# that can run with plain `node worker.js` inside the standalone output.
RUN npx esbuild src/workers/index.ts \
      --bundle \
      --platform=node \
      --target=node20 \
      --format=cjs \
      --outfile=.next/standalone/worker.js \
      --external:bullmq \
      --external:ioredis \
      --external:openai \
      --external:resend \
      --packages=external

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output (includes server.js + node_modules subset)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy knowledge base (read-only at runtime)
COPY --from=builder --chown=nextjs:nodejs /app/kb ./kb

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
