# SpecGuard — OpenAPI Contract Testing Platform

A production-grade TypeScript monorepo that wraps the [Apify TikTok Scraper Actor](https://apify.com/clockworks/tiktok-scraper) behind a stable, versioned internal API contract — then continuously validates that contract and detects schema drift from the upstream actor spec.

**Test results (latest run):** 8/8 passed · 0 contract violations · exit code 0

---

## Technology Stack

| Layer | Technology |
|---|---|
| Language | TypeScript 5 (strict mode) |
| Runtime | Node.js 20 |
| API Framework | Fastify 4 |
| Schema Validation | Zod 3 (runtime), AJV 8 (JSON Schema / OpenAPI) |
| Package Manager | pnpm 10 (workspaces monorepo) |
| Containerization | Docker, Docker Compose (multi-stage builds) |
| CI/CD | GitHub Actions |
| Testing | Vitest |
| OpenAPI Parsing | js-yaml, custom $ref resolver |
| HTTP Client | undici (native Node.js fetch) |

---

## What This Project Demonstrates

**Contract-first API design** — the internal OpenAPI spec is the source of truth. Implementation flows from the contract inward, not the other way around.

**Schema boundary enforcement** — all upstream Apify Actor responses are validated and normalized at a single boundary (Zod `.parse()`) before any business logic runs. Upstream field variants (`id`/`awemeId`, `statsV2`/`stats`, `authorMeta`/`author`) are resolved here and nowhere else.

**Drift detection** — a dedicated `drift-core` package compares the upstream actor spec against the internal wrapper contract on every CI run. It distinguishes between intentional suppression (info), breaking changes (warning), and clean separates the problem from simple test failures.

**Deterministic contract testing** — a Fastify mock server replays fixed scenarios (valid, type-error, out-of-range, 404, running, failed, slow). The contract runner generates test cases from the spec itself and validates HTTP status codes and response bodies against AJV-compiled schemas.

**Zero trust of upstream payloads** — raw actor responses are never passed downstream. They are always parsed with Zod's passthrough schema at the boundary, normalised into stable internal types, then used.

---

## Architecture

```
spec/upstream/actor-openapi.json    ← read-only reference, never modified
        │
        ├── drift-core ──────────── compares upstream vs internal schemas
        │
spec/internal/openapi.yaml          ← the stable product contract
        │
        ├── wrapper-api (:3000) ─── Fastify, Zod validation, normalizer
        │
        └── contract-runner ──────── loads spec → generates tests → AJV validates
                │
        mock-server (:4000) ──────── deterministic Fastify mock, healthchecked
```

### Monorepo Layout

```
apps/
  wrapper-api/      Fastify wrapper — validates input, calls Apify, normalizes output
  mock-server/      Fastify mock — fixed scenarios for contract testing
  contract-runner/  CLI — spec-driven test generation, AJV validation, drift report
packages/
  shared-types/     Zod schemas + TypeScript types (shared across all services)
  openapi-utils/    Spec loading, $ref resolution, schema extraction
  drift-core/       Upstream vs internal spec comparison engine
spec/
  upstream/         actor-openapi.json  (Apify actor spec — read-only)
  internal/         openapi.yaml        (internal wrapper contract)
reports/            JSON report artifact (Docker volume mount)
```

---

## Key Engineering Decisions

**Why a separate mock server instead of mocking in tests?**
The contract runner tests HTTP — not function calls. Running against a real Fastify server over the network catches serialization issues, content-type handling, and status code behaviour that in-process mocks cannot.

**Why Zod at the boundary and AJV for contract validation?**
Zod gives precise TypeScript types and coercion logic for normalizing upstream field variants. AJV compiles OpenAPI JSON Schema into fast validators for checking that _our_ responses match _our_ contract — a different concern.

**Why pnpm workspaces?**
Shared packages (`shared-types`, `openapi-utils`, `drift-core`) are consumed by multiple apps. Workspaces enforce the boundary: changes to `shared-types` must not silently break the contract runner. `pnpm deploy` creates self-contained runtime images with no symlinks.

**Why drift is warn-only by default?**
The upstream actor can change at any time. Blocking CI on every upstream change would make the pipeline unreliable. Instead, drift is surfaced in the report so engineers can triage — only fields the wrapper actively exposes can cause a hard failure.

---

## Test Results

```
Total: 8  Passed: 8  Violations: 0  Drift warnings: 0  Errors: 0

PASSED
  ✓  POST /scrape/tiktok — scrape by hashtag             (52ms)
  ✓  POST /scrape/tiktok — scrape by profile             (11ms)
  ✓  POST /scrape/tiktok — empty body → 400              (6ms)
  ✓  POST /scrape/tiktok — resultsPerPage string → 400   (5ms)
  ✓  POST /scrape/tiktok — resultsPerPage below min → 400 (10ms)
  ✓  GET  /scrape/results/:runId — valid run returns 200  (3ms)
  ✓  GET  /scrape/results/:runId — unknown ID → 404       (5ms)
  ✓  GET  /health — liveness probe                        (4ms)

UPSTREAM SPEC DRIFT
  25 info  — upstream fields intentionally not exposed by wrapper
   0 warning — no breaking changes detected
```

The 25 `FIELD_NOT_EXPOSED_BY_WRAPPER` info items are expected: the Apify actor exposes ~29 input fields (download controls, proxy config, comment depth, advanced filtering). The wrapper intentionally exposes only `hashtags`, `profiles`, `searchQueries`, `postURLs`, and `resultsPerPage` — a stable, simplified surface.

---

## Quick Start

**Prerequisites:** Docker Desktop, or Node.js ≥ 20 + pnpm ≥ 9

### Run everything with Docker

```bash
docker compose up --build
```

Starts `mock-server` (healthchecked), then runs `contract-runner` against it.
Report written to `./reports/report.json`. Exit code 0 = all contracts satisfied.

### Local development (no Docker)

```bash
pnpm install

# Build shared packages (dependency order matters)
pnpm --filter @specguard/shared-types build
pnpm --filter @specguard/openapi-utils build
pnpm --filter @specguard/drift-core build

# Type-check all workspaces
pnpm -r typecheck

# Unit tests
pnpm -r test

# Start mock server
pnpm --filter @specguard/mock-server dev

# Run contract tests against local mock
pnpm --filter @specguard/contract-runner dev -- \
  test \
  --spec spec/internal/openapi.yaml \
  --base-url http://localhost:4000 \
  --upstream-spec spec/upstream/actor-openapi.json \
  --output reports/report.json
```

### Run against the real Apify Actor

Copy `.env.example` to `.env`, add your token, then:

```bash
docker compose up --build wrapper-api

docker compose run --rm contract-runner \
  test \
  --spec /spec/internal/openapi.yaml \
  --base-url http://wrapper-api:3000 \
  --upstream-spec /spec/upstream/actor-openapi.json \
  --output /reports/report.json \
  --fail-on-violation
```

---

## API Reference

### POST /scrape/tiktok

Trigger a TikTok scrape job. Validates input with Zod, starts an Apify Actor run.

**Request**
```http
POST /scrape/tiktok
Content-Type: application/json

{
  "hashtags": ["trending"],
  "resultsPerPage": 10
}
```

At least one of `hashtags`, `profiles`, `searchQueries`, or `postURLs` is required.
`resultsPerPage` must be an integer between 1 and 100 (default 10).

**202 Accepted**
```json
{
  "runId": "abc123RunId",
  "status": "READY",
  "startedAt": "2025-01-08T00:00:00.000Z"
}
```

**400 Bad Request** (validation failure)
```json
{
  "error": "VALIDATION_ERROR",
  "message": "At least one of hashtags, profiles, searchQueries, or postURLs must be provided",
  "details": {}
}
```

---

### GET /scrape/results/:runId

Poll for run status and results. Items are populated when `status` is `SUCCEEDED`.

**200 OK**
```json
{
  "runId": "abc123RunId",
  "status": "SUCCEEDED",
  "items": [
    {
      "id": "7234567890123456789",
      "caption": "Check out this #trending video!",
      "likes": 150000,
      "views": 2500000,
      "comments": 3200,
      "shares": 8500,
      "author": {
        "username": "charlidamelio",
        "displayName": "Charli D'Amelio",
        "followers": 150000000,
        "verified": true
      },
      "createdAt": "2025-01-05T12:30:00.000Z",
      "hashtags": ["trending", "fyp"]
    }
  ]
}
```

**404 Not Found**
```json
{
  "error": "NOT_FOUND",
  "message": "Run 'abc123RunId' not found"
}
```

---

### GET /health

Liveness probe. Returns `200 { "status": "ok" }`.

---

## Normalization

All upstream Apify responses are normalized at the schema boundary in `apps/wrapper-api/src/services/normalizer.ts`. The Apify actor has evolved over time and returns different field names across versions — the normalizer resolves all variants into the stable internal model.

| Upstream field(s) | Internal field | Handling |
|---|---|---|
| `id`, `awemeId` | `id` | String coercion, first non-null wins |
| `text`, `desc`, `caption` | `caption` | First non-empty string wins |
| `diggCount`, `statsV2.diggCount`, `stats.diggCount` | `likes` | Integer coercion, floor at 0 |
| `playCount`, `statsV2.playCount`, `stats.playCount` | `views` | Integer coercion, floor at 0 |
| `commentCount`, `statsV2.commentCount` | `comments` | Integer coercion, floor at 0 |
| `shareCount`, `statsV2.shareCount` | `shares` | Integer coercion, floor at 0 |
| `authorMeta.uniqueId`, `author.uniqueId` | `author.username` | Prefer `authorMeta` |
| `authorMeta.nickName`, `author.nickname` | `author.displayName` | Prefer `authorMeta` |
| `authorMeta.fans`, `author.followerCount` | `author.followers` | Integer, floor at 0 |
| `video.playAddr`, `video.downloadAddr`, `videoUrl` | `videoUrl` | Optional |
| `createTime` (Unix seconds) | `createdAt` | ISO 8601 string |
| `hashtags[]`, `challenges[].title` | `hashtags` | String array |

---

## Drift Detection

`packages/drift-core` compares the upstream actor spec (`spec/upstream/`) against the internal wrapper contract (`spec/internal/`) on every run.

| Drift Type | Severity | Meaning |
|---|---|---|
| `FIELD_REMOVED_FROM_UPSTREAM` | warning | A field the wrapper exposes was removed by the actor |
| `TYPE_CHANGED_IN_UPSTREAM` | warning | Actor changed a field type — normalization may break |
| `CONSTRAINT_CHANGED_IN_UPSTREAM` | warning | min/max/enum changed — check validation logic |
| `FIELD_NOT_EXPOSED_BY_WRAPPER` | info | Actor field intentionally hidden by wrapper |

Warnings fail CI if `--fail-on-violation` is set. Info items are report-only.

---

## CI/CD Pipeline

GitHub Actions (`.github/workflows/ci.yml`):

1. Install pnpm dependencies
2. Build shared packages in dependency order
3. TypeScript type-check all workspaces (`tsc --noEmit`)
4. Run unit tests (Vitest)
5. Build Docker containers
6. Run contract tests — `--fail-on-violation` causes non-zero exit on violations
7. Upload `reports/report.json` as a 30-day build artifact

Upstream drift warnings are surfaced in the artifact but do not fail the pipeline by default.

---

## Environment Variables

| Variable | Service | Default | Required |
|---|---|---|---|
| `APIFY_TOKEN` | wrapper-api | — | Yes (for real runs) |
| `APIFY_ACTOR_ID` | wrapper-api | `clockworks~tiktok-scraper` | No |
| `PORT` | wrapper-api | `3000` | No |
| `PORT` | mock-server | `4000` | No |
| `LOG_LEVEL` | all services | `info` | No |

Copy `.env.example` to `.env` and set `APIFY_TOKEN` to call the real Apify Actor.

---

## Development Rules

All architectural constraints are documented in [CLAUDE.md](./CLAUDE.md) and enforced through code review. Key constraints: TypeScript strict mode everywhere, no `any` without a justification comment, Zod at all external boundaries, separate transport from normalization from validation.
