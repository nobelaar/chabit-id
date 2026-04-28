# Login con email en lugar de username

**Fecha:** 2026-04-28
**Branch:** `loginWithGoogle`

## Qué cambió

El endpoint `POST /auth/sign-in` ya no acepta `username`. Ahora se loguea con `email` y `password`.

### Antes

```json
POST /auth/sign-in
{
  "username": "johndoe",
  "password": "password123"
}
```

### Ahora

```json
POST /auth/sign-in
{
  "email": "john@example.com",
  "password": "password123"
}
```

La respuesta no cambió:

```json
{
  "accessToken": "...",
  "updateToken": "..."
}
```

## Qué hay que actualizar del lado del cliente

Cualquier llamada a `POST /auth/sign-in` que envíe `username` tiene que reemplazarlo por `email`. El campo `username` ahora es ignorado (la validación Zod lo rechaza con 400).

## Cómo funciona internamente

El flujo de autenticación ahora es:

1. Se recibe el `email`
2. Se busca la identidad por email en la tabla `identities`
3. Se obtiene el `identityRef` y se busca la credencial asociada
4. Se verifica la contraseña
5. Se emiten los tokens

Este cambio sigue el patrón hexagonal existente: se agregó un `IdentityQueryPort` en el módulo `credential`, implementado por adapters en el módulo `identity` (igual que el `AccountQueryPort` que ya existía).

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/modules/credential/application/use-cases/SignIn.usecase.ts` | DTO usa `email`, lookup por email vía `IdentityQueryPort` |
| `src/modules/credential/presentation/http/credential.schemas.ts` | Schema: `username` → `email` (validación de formato email) |
| `src/modules/credential/presentation/http/credential.routes.ts` | Pasa `email` al use case |
| `src/modules/registration/application/RegisterSaga.ts` | El auto-login post-registro usa `email` |

## Archivos nuevos

| Archivo | Descripción |
|---|---|
| `src/modules/credential/domain/ports/IdentityQueryPort.port.ts` | Puerto cross-subdomain para resolver email → identityRef |
| `src/modules/identity/infrastructure/adapters/InMemoryIdentityQueryAdapter.ts` | Implementación in-memory (tests) |
| `src/modules/identity/infrastructure/adapters/PostgresIdentityQueryAdapter.ts` | Implementación Postgres (producción) |
