# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /monorepo

COPY pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared-types/ ./packages/shared-types/
COPY packages/openapi-utils/ ./packages/openapi-utils/
COPY packages/drift-core/ ./packages/drift-core/
COPY apps/contract-runner/ ./apps/contract-runner/

RUN pnpm install
RUN pnpm --filter @specguard/shared-types build
RUN pnpm --filter @specguard/openapi-utils build
RUN pnpm --filter @specguard/drift-core build
RUN pnpm --filter @specguard/contract-runner build

# Bundle app + all resolved production deps into a self-contained directory.
# pnpm deploy resolves workspace symlinks (including internal @specguard/* packages)
# and copies actual package files — no .pnpm virtual store in the runtime image.
RUN pnpm --filter @specguard/contract-runner deploy --legacy --prod /deploy

# ── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /deploy .

# Specs are mounted at runtime via docker-compose volume — not baked into image
ENTRYPOINT ["node", "dist/index.js"]
CMD ["test", "--help"]
