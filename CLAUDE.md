# CLAUDE.md — SpecGuard Execution Rules

These rules apply to every task Claude performs in this repository.
Reference this file before making any architectural or implementation decision.

---

## 1. Primary Language

Use **TypeScript** for all application code unless there is a strong, documented reason not to.

TypeScript is required for:
- wrapper API
- contract runner
- drift detection logic
- mock server
- CLI utilities
- shared schema/types packages
- AI orchestration layer (if added later)

Do **not** introduce Python, Go, or another language unless:
- there is a clear library gap
- the implementation would be materially simpler
- the reason is documented in the repo

---

## 2. Architecture Bias

Prefer a small **pnpm monorepo** in TypeScript over a multi-language system.

Target structure:

```
/specguard
  /apps
    /wrapper-api
    /contract-runner
    /mock-server
  /packages
    /shared-types
    /openapi-utils
    /drift-core
  /spec
    /upstream
    /internal
```

Use shared packages for reusable logic instead of duplicating code across services.

---

## 3. Source of Truth

- `spec/upstream/actor-openapi.json` — read-only reference, never modified
- `spec/internal/openapi.yaml` — the actual product contract

Claude must:
- never silently edit the upstream spec
- never collapse upstream and internal contracts into one file
- explicitly separate upstream drift from wrapper violations

---

## 4. Contract-First Development

Implement from the contract inward. Order of work:

1. Store upstream spec
2. Define internal wrapper spec
3. Define normalized output model (shared-types)
4. Implement wrapper API
5. Implement contract validation
6. Implement drift detection
7. Add Docker and CI
8. Add AI layer only after core path works end-to-end

Do **not** start with agent workflows before the contract path is working.

---

## 5. Framework Choices

Prefer boring, stable tooling.

| Concern | Tool |
|---|---|
| Runtime | Node.js + TypeScript |
| API framework | Fastify |
| Runtime validation / normalization | Zod |
| OpenAPI schema validation | AJV |
| HTTP client (runner) | undici / native fetch |
| Package manager | pnpm (workspaces) |
| Test runner | Vitest |

Avoid heavy frameworks unless they provide clear value.

---

## 6. Docker Rules

Every runnable service must have a Dockerfile.

- Use multi-stage Docker builds where reasonable
- Keep images small (node:20-alpine base)
- Avoid unnecessary OS packages
- Make local Docker execution the default validation path

The repo must work through:
```
docker compose up --build
```

Do not require hidden manual steps.

---

## 7. Coding Style

- `strict: true` in all tsconfig files
- No `any` unless justified in a comment
- Prefer explicit interfaces and schema-backed parsing (Zod)
- No deeply abstracted generic frameworks
- Keep functions small and named by responsibility
- Separate transport logic from normalization logic
- Separate validation from reporting

---

## 8. Validation Rules

Never trust upstream payloads.

- Validate all external Actor responses at the boundary (Zod `.parse()` or `.safeParse()`)
- Normalize into internal stable models before any business logic
- Reject or flag malformed responses clearly
- Distinguish between:
  - transport errors
  - upstream schema drift
  - wrapper contract violations
  - test assertion failures

---

## 9. Error Handling

Errors must be structured and observable.

All services return:
- machine-readable `error` code
- human-readable `message`
- optional `details` object for debugging context

Do not swallow exceptions or return vague messages.

---

## 10. Reporting Rules

Minimum outputs:
- Console summary (human-readable)
- JSON report artifact

Separate report sections:
- Passed tests
- Failed contract validations
- Upstream drift warnings
- Infrastructure / runtime failures

---

## 11. Testing Rules

Write tests alongside implementation. Minimum required:

- Unit tests for normalization (`packages/shared-types` or `apps/wrapper-api`)
- Unit tests for drift comparison logic (`packages/drift-core`)
- Integration tests for wrapper API
- End-to-end contract test against wrapper + mock target

Do not mark the task complete without tests.

---

## 12. CI Rules

GitHub Actions workflow must:

1. Install dependencies (pnpm)
2. Type-check (`tsc --noEmit`)
3. Run tests (Vitest)
4. Build containers
5. Run contract validation
6. Fail on contract violations

Upstream drift: warning by default unless the internal contract directly depends on the changed field.

---

## 13. AI Integration Rules

AI is **Phase 2**, not MVP.

When adding AI:
- Use TypeScript for orchestration
- Pass structured JSON between steps
- Do not rely on free-form prompts as the system contract
- Keep deterministic validators as final authority
- LLM output may suggest tests or analyze drift — never replace schema validation

> AI proposes. Validators decide.

---

## 14. Dependency Rules

- Prefer widely adopted libraries
- Avoid duplicate libraries for the same job
- Justify unusual dependencies in README or comments
- Do not add a framework just because it is fashionable

---

## 15. Documentation Rules

Must include in README:
- Architecture overview
- Service responsibilities
- Local run instructions
- Example requests / responses
- How upstream spec is used
- How drift detection works
- What is fail vs warn behavior

---

## 16. Completion Rules

The task is complete only when:

- [ ] TypeScript workspace builds cleanly (`pnpm build`)
- [ ] Docker Compose works (`docker compose up --build`)
- [ ] Wrapper API serves the internal contract
- [ ] Runner validates against internal OpenAPI spec
- [ ] Upstream spec comparison produces drift report
- [ ] Tests pass (`pnpm test`)
- [ ] CI config exists (`.github/workflows/ci.yml`)
- [ ] README explains the full workflow
