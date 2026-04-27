# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Development with hot reload (tsx watch)
npm test             # Run all tests once (Vitest)
npm run test:watch   # Watch mode
npm run build        # TypeScript compile + copy migrations to dist/
npm start            # Run production build
npm run migrate      # Run DB migrations manually
npm run seed         # Seed admin + test users

# Docker
docker compose up -d                    # Start app + postgres
docker compose --profile seed up seed   # Run seeder
```

There is no lint script. TypeScript strict mode (ESM) is the enforced code-quality gate.

## Architecture

This is the **chabit-identity** microservice: authentication, identity, and account management for the Chabit platform. It uses **Hexagonal Architecture (Ports & Adapters)** with **DDD** and a **Saga pattern** for registration.

### Module structure

Six subdomains under `src/modules/`, each with strict layer separation:

```
<module>/
  domain/
    entities/        aggregate roots with business logic
    value-objects/   immutable validated types
    errors/          typed domain exceptions
    ports/           interfaces to infra and cross-subdomain dependencies
  application/
    use-cases/       orchestration and policy
  infrastructure/
    persistence/     PostgresXxxRepository + InMemoryXxxRepository
    adapters/        hashing, JWT, email, etc.
  presentation/
    http/            Hono routes + Zod schemas
```

Subdomains:
- **identity** — personal data, email verification state, BLNK reference
- **credential** — username, password, JWT sessions, refresh tokens
- **account** — roles (USER, ORGANIZER, ADMIN, COMMERCE, STAFF, EMPLOYEE) and their statuses
- **verification** — OTP email verification with HMAC-SHA256 and rate limiting
- **registration** — `RegisterSaga` orchestrating the five subdomains above
- **check** — validation/checking endpoints

Shared kernel (`src/shared/`) contains: `Email`, `PhoneNumber`, `IdentityRef` value objects; PostgreSQL pool; `MigrationRunner`; pino logger; Hono server factory and auth middleware.

### RegisterSaga

`RegisterSaga` (in `registration/`) runs Steps 1–5 in sequence: Verification → Identity → Credential → Account → SignIn. Each step has explicit **compensation** logic (hard delete in reverse order) if a later step fails. Fire-and-forget steps (AssignBlnkRef, LinkVerificationToIdentity, event logging) tolerate failure without rolling back.

### Key design decisions

- **No ORM** — raw `pg` queries for full control
- **HS256 JWT** — acceptable for two services; upgrade path to RS256 documented in ARCHITECTURE.md
- **Access token in response body** — supports mobile clients; mitigated with 15-min TTL
- **SELECT FOR UPDATE in VerifyEmail** — prevents concurrent OTP race conditions
- **Trusted caller pattern** — API key header implies ADMIN role for internal endpoints
- **Rate limiting inside app factory** — isolates limiter state between test instances

## Testing

Tests are co-located with source (`*.spec.ts`). E2E smoke tests live in `src/e2e/*.e2e.spec.ts`.

E2E tests use **in-memory repositories** (no real PostgreSQL). The app is created via `src/shared/presentation/http/test-app.ts` factory and tested with Hono's `app.request()`. `StubEmailSender` captures OTP codes without mocking — tests read from the stub directly after triggering flows.

To run a single test file:
```bash
npx vitest run src/e2e/auth.e2e.spec.ts
npx vitest run src/modules/credential/domain/entities/Credential.entity.spec.ts
```

## Stack

| Concern | Technology |
|---|---|
| Runtime | Node.js 22, TypeScript 5.9 (ESM strict) |
| HTTP | Hono 4 + @hono/node-server |
| Database | PostgreSQL 16, raw `pg` driver |
| Validation | Zod 4 + @hono/zod-validator |
| Auth | jsonwebtoken (HS256, 15-min access / 7-day refresh) |
| Password | bcryptjs (10 rounds) |
| OTP | HMAC-SHA256 via node:crypto |
| Logging | pino (pretty dev, JSON prod) |
| Email | nodemailer (SMTP) or StubEmailSender (no SMTP_HOST) |
| Tests | Vitest |
| API docs | OpenAPI 3.0.3 + Swagger UI at `/docs` |

## Deep-dive documentation

- `ARCHITECTURE.md` — full subdomain breakdown, DB schema, endpoint catalogue, error mapping, JWT format, and documented tech debt
- `.env.example` — all required environment variables with descriptions
