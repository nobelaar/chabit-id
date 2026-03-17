# Docker Setup Design

**Date:** 2026-03-17

## Goal

Dockerize both chabit-identity and backend-chabit so the stack runs identically on any machine. Each repo has its own independent `Dockerfile` + `docker-compose.yml` (no shared compose), which is the natural model for future Kubernetes deployment.

---

## chabit-identity

### What changes

The `Dockerfile` and `docker-compose.yml` already exist and work. Three env vars added by the auth migration are missing from `docker-compose.yml`:

- `WEBHOOK_BACKEND_URL` — URL where backend-chabit receives the registration webhook
- `WEBHOOK_SECRET` — HMAC key for signing webhook payloads (must match backend-chabit)
- SMTP vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM`) — optional; if absent, `StubEmailSender` is used (OTP logged to console)

### docker-compose.yml update

Add to the `app` service `environment` block:

```yaml
WEBHOOK_BACKEND_URL: ${WEBHOOK_BACKEND_URL:-}
WEBHOOK_SECRET: ${WEBHOOK_SECRET:-}
SMTP_HOST: ${SMTP_HOST:-}
SMTP_PORT: ${SMTP_PORT:-25}
SMTP_SECURE: ${SMTP_SECURE:-false}
SMTP_FROM: ${SMTP_FROM:-noreply@chabit.com}
```

No changes to `Dockerfile` or the `postgres` service.

---

## backend-chabit

### Prisma: SQLite → PostgreSQL

Change `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Delete all existing SQLite migration files under `prisma/migrations/` and run:
```bash
npx prisma migrate dev --name init
```

This generates a single clean PostgreSQL migration from the current schema state.

`DATABASE_URL` format changes to:
```
postgresql://chabit:chabit@localhost:5432/chabit_backend
```

### Dockerfile (new)

Multi-stage build:

```dockerfile
# Stage 1: Builder
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma/ ./prisma/
RUN npm ci
COPY tsconfig*.json ./
COPY src/ ./src/
RUN npm run build
RUN npx prisma generate

# Stage 2: Runtime
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma/ ./prisma/
RUN npm ci --omit=dev
RUN node_modules/.bin/prisma generate
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/main"]
```

**Key decisions:**
- `prisma/` is copied before `npm ci` in builder so `prisma generate` finds the schema
- `prisma generate` runs in both stages: builder (for the build) and runtime (to regenerate the typed client against the production `node_modules`)
- `node_modules/.bin/prisma` used consistently — avoids `npx` resolution issues
- `prisma/` is copied to runtime so `migrate deploy` can find the migration files
- `migrate deploy` is idempotent — safe to run on every restart
- **Prerequisite — `package.json`:** both `prisma` (CLI) and `@prisma/client` must be in `dependencies` (not `devDependencies`). Without this, `npm ci --omit=dev` strips them and the runtime stage fails.

### docker-compose.yml (new)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: chabit
      POSTGRES_PASSWORD: chabit
      POSTGRES_DB: chabit_backend
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U chabit -d chabit_backend"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build: .
    ports:
      - "${PORT:-3000}:3000"
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://chabit:chabit@postgres:5432/chabit_backend
      JWT_SECRET: ${JWT_SECRET}
      WEBHOOK_SECRET: ${WEBHOOK_SECRET}
      CHABIT_IDENTITY_URL: ${CHABIT_IDENTITY_URL:-http://localhost:3001}
      # Remaining vars passed through from .env
      STAFF_JWT_SECRET: ${STAFF_JWT_SECRET:-}
      TICKET_SECRET: ${TICKET_SECRET:-}
      BLNK_BASE_URL: ${BLNK_BASE_URL:-http://localhost:5010}
      BLNK_HTTP_TIMEOUT: ${BLNK_HTTP_TIMEOUT:-5000}
      STRIPE_SK_TEST: ${STRIPE_SK_TEST:-}
      STRIPE_WEBHOOK_TEST: ${STRIPE_WEBHOOK_TEST:-}
      REDIS_URL: ${REDIS_URL:-redis://localhost:6379}
      CORS_ORIGIN: ${CORS_ORIGIN:-*}
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
```

### .dockerignore (new)

```
node_modules/
dist/
*.db
*.db-journal
.env
.env.*
```

### .env.example update

Add `DATABASE_URL` in PostgreSQL format and update the shared-secret warning comments:

```env
# Base de datos (PostgreSQL)
DATABASE_URL=postgresql://chabit:chabit@localhost:5432/chabit_backend

# ⚠️  DEBE coincidir con JWT_SECRET de chabit-identity
JWT_SECRET=changeme-jwt-secret

# ⚠️  DEBE coincidir con WEBHOOK_SECRET de chabit-identity
WEBHOOK_SECRET=change-me-in-production
```

---

## Shared secrets

These two values **must be identical** across both services. If they differ, the system silently breaks:

| Secret | Effect if mismatched |
|--------|---------------------|
| `JWT_SECRET` | backend-chabit rejects all tokens issued by chabit-identity (401 on every authenticated request) |
| `WEBHOOK_SECRET` | backend-chabit rejects all registration webhooks (wallet never created) |

Both `.env.example` files carry a `⚠️ DEBE coincidir` comment on these vars.

---

## What is NOT in scope

- Kubernetes manifests
- CI/CD pipeline
- Redis container (backend-chabit's `REDIS_URL` is passed through as an env var; user provides their own Redis)
- Blnk container (same — external dependency)
- Stripe integration (env vars passed through)
- Production TLS / reverse proxy
