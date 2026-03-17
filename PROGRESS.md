# chabit-identity — Progress

## Estado actual

### Iteración 1 — COMPLETADA ✅

Scaffold + Subdominio Verification completo (dominio → HTTP).

**Tests:** 26 passing

**Endpoints:**
```
GET  /health
POST /verification/email          → 201 { verificationId }
POST /verification/email/verify   → 200 { verificationId, usedAt }
```

---

### Iteración 2 — COMPLETADA ✅

HTTP Rate Limiting + Subdominio Identity completo.

**Construido:**
- Rate limiting: `POST /verification/email` → 3 req/min, `POST /verification/email/verify` → 10 req/min (hono-rate-limiter, in-memory)
- Identity VOs: `IdentityId` (UUID v4), `FullName`, `Nationality`, `Country`, `BlnkIdentityRef`
- Identity entity: `create()`, `fromPrimitive()`, `assignBlnkRef()`, `updateProfile()`
- Identity errors: `IdentityNotFoundError`, `EmailAlreadyRegisteredError`, `PhoneAlreadyRegisteredError`, `EmailNotVerifiedError`, `BlnkRefAlreadyAssignedError`
- Identity port: `IdentityRepository` (save, findById, findByEmail, findByPhone, hardDelete)
- Use cases: `CreateIdentityUseCase`, `GetIdentityUseCase`, `UpdateProfileUseCase`
- Infrastructure: `InMemoryIdentityRepository`, `PostgresIdentityRepository`
- Migration: `003_create_identities.sql`

**Tests:** 66 passing (+40 nuevos)

---

### Iteración 3 — COMPLETADA ✅

Subdominio Credential completo.

**Construido:**
- Deps: `bcryptjs`, `jsonwebtoken` instalados
- Credential VOs: `CredentialId`, `Username`, `RawPassword`, `PasswordHash`, `UpdateToken`, `SessionId`
- Session entity: `create()`, `rotate()`, `isExpired()`, TTL 30 días sliding window
- Credential entity: `create()`, `updatePassword()`, `changeUsername()`
- Credential errors: `CredentialNotFoundError`, `InvalidCredentialsError`, `SessionNotFoundError`, `SessionExpiredError`, `UsernameAlreadyTakenError`, `UsernameReservedError`, `CannotChangeUsernameYetError`
- Ports: `CredentialRepository`, `SessionRepository` (9 métodos), `PasswordHasher`, `TokenService`, `AccountQueryPort`, `UsernameReservedList`
- Use cases: `CreateCredentialUseCase`, `SignInUseCase`, `RefreshTokenUseCase`, `ChangePasswordUseCase`, `RevokeTokenUseCase`, `RevokeAllTokensUseCase`, `ChangeUsernameUseCase`
- Infrastructure: `BcryptPasswordHasher`, `JwtTokenService` (JWT HS256, 15min TTL), `StaticUsernameReservedList`, `InMemoryCredentialRepository`, `InMemorySessionRepository`, `PostgresCredentialRepository`, `PostgresSessionRepository`
- Migration: `004_create_credentials_sessions.sql`
- HTTP routes: `POST /auth/sign-in`, `POST /auth/refresh`, `POST /auth/sign-out`
- Stub `AccountQueryPort` (returns `[]` — se reemplaza en Iteración 4)

**Tests:** 87 passing (+21 nuevos)

**Endpoints:**
```
POST /auth/sign-in    → 200 { accessToken, updateToken }
POST /auth/refresh    → 200 { accessToken, updateToken }
POST /auth/sign-out   → 200 { message }
```

---

### Iteración 4 — COMPLETADA ✅

Subdominio Account completo.

**Construido:**
- Account VOs: `AccountId`, `AccountStatus`, `AccountType`
- Account entity: `createUser()`, `createOrganizer()`, `createAdmin()`, `fromPrimitive()`, state transitions
- Account errors: `AccountAlreadyExistsError`, `InvalidStatusTransitionError`, `InsufficientPermissionsError`
- Ports: `AccountRepository` (8 métodos), `AccountEventRepository`
- Use cases: `CreateAccountUseCase`, `RequestOrganizerUseCase`, `ApproveOrganizerUseCase`, `RejectOrganizerUseCase`, `ReRequestOrganizerUseCase`, `DeactivateAccountUseCase`, `ReactivateAccountUseCase`, `GetAccountsByIdentityUseCase`
- Infrastructure: `InMemoryAccountRepository`, `InMemoryAccountEventRepository`, `InMemoryAccountQueryAdapter`, `PostgresAccountRepository`, `PostgresAccountEventRepository`, `PostgresAccountQueryAdapter`
- Migration: `005_create_accounts.sql`
- HTTP routes: `POST /accounts`, `PATCH /accounts/:id/organizer/request`, etc.
- `AccountQueryPort` connected to real repo (replaces stub from Iteración 3)

**Tests:** 118 passing

**Endpoints:**
```
GET  /accounts/:identityRef
POST /accounts/:id/organizer/request
POST /accounts/:id/organizer/approve
POST /accounts/:id/organizer/reject
POST /accounts/:id/organizer/re-request
```

---

### Iteración 5 — COMPLETADA ✅

RegisterSaga + POST /register.

**Construido:**
- `RegisterSaga`: orchestrates Identity + Credential + Account(USER) + SignIn with compensations
- Guard: verifies `verificationId` is USED and email matches
- Step 1: `CreateIdentity` → compensation: `hardDelete(identityId)`
- Sub-step 1a: `LinkVerificationToIdentity` — fire & forget, tolerated failure
- Step 2: `CreateCredential` → compensation: `hardDelete(identityId)`
- Step 3: `CreateAccount(USER)` → compensation: `hardDelete(credentialId)` + `hardDelete(identityId)`
- Step 4: `SignIn` → returns `{ accessToken, updateToken }` — no compensation
- `registration.routes.ts`: `POST /register` → 201 `{ accessToken, updateToken }`
- `registration.schemas.ts`: Zod validation schema
- Server wired with `PostgresIdentityRepository` + `CreateIdentityUseCase`

**Tests:** 125 passing (+7 nuevos)

**Endpoints:**
```
POST /register → 201 { accessToken, updateToken }
```

---

---

### Iteración 6 — COMPLETADA ✅

NodemailerEmailSender (SMTP adapter).

**Construido:**
- `NodemailerEmailSender`: implementa `EmailSender` port vía nodemailer
- `src/index.ts`: instancia `NodemailerEmailSender` cuando `SMTP_HOST` está seteado, sino usa `StubEmailSender`
- `.env.example` + README actualizados con vars SMTP

**Tests:** 162 passing (+3 nuevos — NodemailerEmailSender.spec)

---

### Plan de Migración Auth — EN PROGRESO 🔄

**Goal:** Migrar auth/registro de backend-chabit (NestJS) a chabit-identity (Hono). chabit-identity emite JWTs; backend-chabit los valida localmente y recibe webhook HMAC para crear wallet Blnk.

**Plan:** `docs/superpowers/plans/2026-03-16-chabit-identity-migration.md`
**Spec:** `docs/superpowers/specs/2026-03-16-chabit-identity-migration-design.md`

#### chabit-identity — rama `feat/auth-migration`

| Tarea | Estado |
|-------|--------|
| Task 1: Add STAFF to AccountType VO | ✅ `fa8e7a3` |
| Task 2: Generalize Account guards + add `createStaff()` | ✅ `50b1ace` |
| Task 3: Add STAFF tests to Account.entity.spec.ts | ✅ `50b1ace` |
| Task 4: Create RequestStaff use case | ⏳ pendiente |
| Task 5: Create ReRequestStaff use case | ⏳ pendiente |
| Task 6: Add STAFF routes + `GET /identities/:identityRef` | ⏳ pendiente |
| Task 7: WebhookSender port + HttpWebhookSender | ⏳ pendiente |
| Task 8: Wire WebhookSender into RegisterSaga | ⏳ pendiente |
| Task 9: Wire server.ts + update .env.example | ⏳ pendiente |

#### backend-chabit — rama `feat/auth-migration`

| Tarea | Estado |
|-------|--------|
| Task 10: Prisma schema migration (remove password/role/status) | ✅ |
| Task 11: AuthGuard — `deriveRole()` desde `accounts` array del JWT | ✅ |
| Task 12: Enable rawBody in main.ts | ✅ |
| Task 13: WebhooksModule + WebhooksController (HMAC fail-closed) | ✅ `9afcd1c` |
| Task 14: ChabitIdentityClient integration + UserService.ensureUser | ✅ `007a533` |
| Task 15: Resolver `req.user.sub` → `user.id` en 8 controllers | ✅ `eaec429` |
| Task 16: Verify wallet-missing coverage | ✅ `b17b481` |
| Task 17: Delete obsolete AuthService + AuthController | ✅ `398da9b` |
| Task 18: Delete obsolete UserService methods | ✅ `15ca7db` |
| Task 19: Clean up MailModule OTP methods | ✅ `15ca7db` |
| Task 20: Final verification (test suite) | ✅ `faf7aaf` |

**Tests backend-chabit:** 370/418 passing — 12 suites con fallas pre-existentes (no relacionadas a la migración)
**Tests chabit-identity:** 162/162 passing

---

## Decisiones técnicas

| Decisión | Motivo |
|----------|--------|
| SERIAL (number) para VerificationId | La DB asigna el id — más simple que UUID para este agregado |
| HMAC-SHA256 con salt por OTP | Resistente a rainbow tables, usa `node:crypto` sin deps extra |
| `attempt()` incrementa antes de verificar | Fiel a la arquitectura |
| Fire & forget para `email_events` y `account_events` | Auditoría eventual — no bloquea el flujo principal |
| Transaction client pasado explícitamente al repo | SELECT FOR UPDATE dentro de tx para VerifyEmail |
| `VerifyEmailResult` incluye `usedAt` | La `RegisterSaga` lo necesita como `emailVerifiedAt` |
| UUID v4 para IdentityId, CredentialId, SessionId, UpdateToken | `crypto.randomUUID()` nativo, sin deps |
| bcrypt rounds=10 para passwords | Balance seguridad/performance estándar |
| JWT HS256, TTL 15 min | Access token corto; sliding sessions 30 días via UpdateToken |
| StubAccountQueryPort en Iteración 3 | Desacoplamiento; se conecta al repo real en Iteración 4 |

## Deuda técnica

- **JWT_SECRET**: usa `process.env['JWT_SECRET'] ?? 'dev-secret'` — requiere env var en producción
- **AccountQueryPort stub**: retorna `[]` hasta Iteración 4
- **RevokeToken**: extrae sessionId del header `x-session-id` — en producción se extrae del JWT verificado por middleware
