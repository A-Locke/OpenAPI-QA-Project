# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /monorepo

# Copy workspace manifests first for layer caching
COPY pnpm-workspace.yaml package.json tsconfig.base.json ./

# Copy only the packages this app depends on
COPY packages/shared-types/ ./packages/shared-types/
COPY apps/wrapper-api/ ./apps/wrapper-api/

# Install all workspace deps
RUN pnpm install

# Build shared-types first, then the app
RUN pnpm --filter @specguard/shared-types build
RUN pnpm --filter @specguard/wrapper-api build

# Bundle app + all resolved production deps into a self-contained directory.
# pnpm deploy resolves workspace symlinks and copies actual package files —
# no .pnpm virtual store or dangling symlinks in the runtime image.
RUN pnpm --filter @specguard/wrapper-api deploy --legacy --prod /deploy

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /deploy .

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').request({hostname:'localhost',port:3000,path:'/health'},r=>r.statusCode===200?process.exit(0):process.exit(1)).on('error',()=>process.exit(1)).end()"

CMD ["node", "dist/index.js"]
