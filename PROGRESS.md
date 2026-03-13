# chabit-identity — Progress

## Estado actual

### Iteración 1 — COMPLETADA ✅

Scaffold + Subdominio Verification completo (dominio → HTTP).

**Construido:**
- Scaffold: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.env.example`
- Shared domain: `DomainError`, `Email.vo`, `PhoneNumber.vo` (stub), `IdentityRef.vo` (stub)
- Shared infrastructure: `pgPool`, `MigrationRunner`, `run-migrations`, migration SQL
- Verification domain: VOs (`VerificationId`, `VerificationStatus`, `OtpCode`, `OtpHash`, `OtpSalt`), entidad `EmailVerification`, errores, 5 ports
- Verification application: `RequestEmailVerificationUseCase`, `VerifyEmailUseCase`, DTOs
- Verification infrastructure: `HmacOtpHasher`, `CryptoOtpGenerator`, `StubEmailSender`, `PostgresEmailVerificationRepository`, `InMemoryEmailVerificationRepository`, `PostgresEmailEventRepository`, `InMemoryEmailEventRepository`
- Verification presentation: `verification.routes.ts`, `verification.schemas.ts`
- Shared presentation: `server.ts`, `error-handler.ts`, `cors.middleware.ts`
- Entry point: `src/index.ts` con graceful shutdown
- Tests: 26 tests, 100% passing

**Endpoints expuestos:**
```
GET  /health
POST /verification/email          → 201 { verificationId }
POST /verification/email/verify   → 200 { verificationId, usedAt }
```

---

## Decisiones técnicas

| Decisión | Motivo |
|----------|--------|
| SERIAL (number) para VerificationId | La DB asigna el id — más simple que UUID para este agregado |
| HMAC-SHA256 con salt por OTP | Resistente a rainbow tables, usa `node:crypto` sin deps extra |
| `attempt()` incrementa antes de verificar | Fiel a la arquitectura: el 5to intento correcto accede (USED con attempts=5); el 5to fallido bloquea |
| Fire & forget para `email_events` | Auditoría eventual — no bloquea el flujo principal |
| Transaction client pasado explícitamente al repo | `findPendingByEmailForUpdate(email, tx)` y `save(v, tx?)` aceptan un `PoolClient` externo; el port usa `unknown`, el impl castea a `PoolClient`, InMemory ignora. El SELECT FOR UPDATE y el UPDATE subsiguiente comparten la misma transacción. |
| `VerifyEmailResult` incluye `usedAt` | La `RegisterSaga` lo necesita como `emailVerifiedAt` para `CreateIdentity` |
| `StubEmailSender` en dev | Log en consola — el puerto permite swappear por real (SES, SendGrid, etc.) |
| Error handler granular con `retryAfter` | El cliente puede implementar UI de countdown sin parsing de strings |

---

## Deuda técnica

- **Rate limiting HTTP**: `hono-rate-limiter` instalado pero no configurado (baja prioridad hasta tener Redis o store compartido)
- **OTP_HMAC_SECRET**: El `HmacOtpHasher` usa el salt como clave HMAC. En producción, considerar un secret global fijo desde env vars como clave HMAC + salt por registro como nonce

---

## Próximas iteraciones

### Iteración 2 — Subdominio Identity
- `Identity` aggregate (identityId UUID, email, status: ACTIVE|SUSPENDED|DELETED)
- `CreateIdentity.usecase` — se llama después de verificar email exitosamente
- Tabla `identities`
- `LinkVerificationToIdentity` — asocia `email_verifications.identity_id`

### Iteración 3 — Subdominio Credential
- `PasswordCredential` entity (bcrypt hash, salt)
- `SetPassword.usecase`
- `VerifyPassword.usecase`
- Tabla `credentials`

### Iteración 4 — Subdominio Account
- `Account` aggregate (accountId, identityId, roles, permissions)
- `CreateAccount.usecase`
- Tabla `accounts`

### Iteración 5 — RegisterSaga
- Saga coordinator: `RequestEmailVerification → VerifyEmail → CreateIdentity → CreateAccount`
- Compensación en caso de error
- Endpoint `POST /register` como punto de entrada unificado

### Iteración 6 — JWT middleware
- `GenerateTokenPair.usecase` (access + refresh)
- Middleware de autenticación para rutas protegidas
- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`
