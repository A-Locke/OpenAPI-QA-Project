---
name: SpecGuard TypeScript + monorepo rules
description: User requires TypeScript for all code, pnpm monorepo, Fastify, Zod, Vitest — enforced across all sessions
type: feedback
---

Always use TypeScript for all application code in this project. Never introduce plain JavaScript files.

**Why:** User explicitly defined 16 execution rules covering language, architecture, tooling, and CI. Any JS-first drafts must be discarded and rewritten.

**How to apply:**
- All apps (wrapper-api, mock-server, contract-runner) → TypeScript + Fastify
- Validation at boundaries → Zod schemas (not manual if-checks)
- OpenAPI/schema validation in runner → AJV
- Unit + integration tests → Vitest
- Package manager → pnpm workspaces
- Strict TypeScript mode (`"strict": true`), no `any` without comment
- Monorepo layout: `/apps/*` for runnable services, `/packages/*` for shared logic
- Shared packages: `@specguard/shared-types`, `@specguard/openapi-utils`, `@specguard/drift-core`
- Docker: multi-stage builds, monorepo root as build context, `docker compose up --build` must work with no manual steps
- Reporting: console summary + JSON artifact, separate sections for violations / drift warnings / failures
- CI: GitHub Actions — install → typecheck → test → build containers → run contract validation
- AI agents are Phase 2 only; never start before core contract path works end-to-end
- Contract-first: define specs → types → normalizer → API → validation → drift → Docker → CI
