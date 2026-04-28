# Registro simplificado — solo email y contraseña

**Fecha:** 2026-04-28
**Branch:** `loginWithGoogle`
**Estado:** rama lista, sin merge a main

---

## Qué cambió

### 1. Login con email

`POST /auth/sign-in` ya no acepta `username`. Ahora requiere `email`:

```json
// Antes
{ "username": "janedoe", "password": "supersecret123" }

// Ahora
{ "email": "jane@example.com", "password": "supersecret123" }
```

### 2. Registro simplificado

`POST /register` eliminó todos los campos de perfil:

```json
// Antes
{
  "verificationId": 42,
  "email": "jane@example.com",
  "password": "supersecret123",
  "fullName": "Jane Doe",
  "phone": "5491112345678",
  "nationality": "Argentine",
  "country": "Argentina",
  "username": "janedoe"
}

// Ahora
{
  "verificationId": 42,
  "email": "jane@example.com",
  "password": "supersecret123"
}
```

El `username` se auto-genera internamente con el formato `user_a3f9b2c1` (puede cambiarse después con `PATCH /auth/change-username`).

### 3. Webhook `identity.registered`

```json
// Antes
{ "event": "identity.registered", "identityRef": "...", "email": "...", "username": "...", "fullName": "...", "phone": "...", "nationality": "...", "country": "...", "registeredAt": "..." }

// Ahora
{ "event": "identity.registered", "identityRef": "...", "email": "...", "registeredAt": "..." }
```

---

## Deuda técnica — KYC

Los campos `fullName`, `phone`, `nationality` y `country` se eliminaron del registro porque van a ser responsabilidad del proveedor de KYC (posiblemente Binance KYC, aún no definido).

**Qué queda pendiente cuando se defina el KYC:**
- Elegir proveedor (Binance KYC u otro)
- Crear tabla `kyc_profiles` vinculada a `identity_id` con los campos que devuelva ese proveedor (nombre, apellido, documento, etc. — no necesariamente `fullName`)
- Implementar el flujo de KYC en chabit-id
- Los campos de perfil en `identities` (`full_name`, `phone`, `nationality`, `country`) quedaron **nullable** en la DB via migración `008_make_identity_profile_nullable.sql` — se llenarán o se migrarán cuando llegue el KYC

---

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/modules/registration/presentation/http/registration.schemas.ts` | Solo `verificationId`, `email`, `password` |
| `src/modules/registration/application/RegisterSaga.ts` | Elimina campos de perfil del input, auto-genera username |
| `src/modules/identity/domain/entities/Identity.entity.ts` | Campos de perfil opcionales (`undefined`) |
| `src/modules/identity/application/use-cases/CreateIdentity.usecase.ts` | Campos de perfil opcionales, phone check condicional |
| `src/modules/identity/infrastructure/persistence/InMemoryIdentityRepository.ts` | `findByPhone` maneja phone undefined |
| `src/modules/identity/infrastructure/persistence/PostgresIdentityRepository.ts` | `toEntity` maneja nulls de la DB |
| `src/shared/presentation/http/openapi.ts` | Actualiza spec de `/register` y `/auth/sign-in` |

## Archivos nuevos

| Archivo | Descripción |
|---|---|
| `src/shared/infrastructure/db/migrations/008_make_identity_profile_nullable.sql` | Hace nullable `full_name`, `phone`, `nationality`, `country` en `identities` |
