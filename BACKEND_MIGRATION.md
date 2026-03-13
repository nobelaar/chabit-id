# BACKEND_MIGRATION.md — Cambios en `backend-chabit`

> Documento de referencia para todo lo que hay que modificar en `backend-chabit`
> cuando se despliegue `chabit-identity`.
>
> El backend **no se toca** durante el desarrollo de este servicio.
> Estas tareas se ejecutan en paralelo o inmediatamente después del despliegue.

---

## 🔴 Breaking — deben hacerse al momento del despliegue

### Auth guards

- `AuthGuard`: dejar de leer `payload.role`, pasar a leer `payload.accounts[]`
- `RolesGuard`: reescribir para verificar si el usuario tiene un account del tipo requerido con `status: ACTIVE`. El JWT solo trae accounts activos — no hay que filtrar por APPROVED.
- El tipo `RoleType` pasa a ser `AccountType`: `USER | ORGANIZER | ADMIN`

### Eliminar lógica de auth del backend

- Eliminar `AuthService.signIn` — pasa a chabit-identity
- Eliminar `AuthService.refreshAccessToken` — pasa a chabit-identity
- Eliminar `AuthService.loginAndRequestOrganizer` — se descompone en `SignIn` + `RequestOrganizer` (dos llamadas separadas al frontend)
- Eliminar `AuthService.verifyToken` — el guard verifica el JWT localmente con el secret compartido
- El `AuthController` queda vacío o se elimina — los endpoints de auth son de chabit-identity

### Módulo `mail` (email verification)

- El módulo `mail` entero se elimina — pasa al subdominio `Verification` de chabit-identity
- `EmailVerification` y `EmailEvent` se eliminan del schema de Prisma
- `MailController`, `MailService`, `mail-templates.ts` se eliminan

### Campos a eliminar del modelo `User` en Prisma

```
password        → vive en Credential (chabit-identity)
updateToken     → vive en Session    (chabit-identity)
emailVerifiedAt → vive en Identity   (chabit-identity)
role            → vive en Account    (chabit-identity) — el JWT lo trae
status          → vive en Account    (chabit-identity) — el JWT lo trae
verifications   → relación con EmailVerification, se elimina con el modelo
```

### Aclaración sobre `User.identityId`

Actualmente `User.identityId` almacena el ID de BLNK (externo), **no** un ID de Chabit.
En chabit-identity ese campo se llama `identity.blnkIdentityRef`.

Al migrar:
- `User.identityId` → renombrar a `User.blnkRef` para evitar confusión
- `User.id` (UUID) es el que se preserva como `identity.id` en chabit-identity

### Agregar `IdentityClient`

Mismo patrón que `EventClient` / `TicketClient` de chabit-ticketing:

```ts
// src/integrations/chabit-identity/identity.client.ts
class IdentityClient {
  approveOrganizer(identityId: string): Promise<void>
  rejectOrganizer(identityId: string): Promise<void>
  getIdentityById(identityId: string): Promise<IdentityResponse>
}
```

---

## 🟡 No breaking — pueden hacerse después del despliegue

### Endpoints que se mueven a chabit-identity

| Endpoint actual (backend) | Nuevo hogar |
|---------------------------|-------------|
| `POST /user/checkUserName` | chabit-identity — endpoint público de disponibilidad de username |
| `POST /user/checkEmail` | chabit-identity — endpoint público de disponibilidad de email |
| `POST /user/isPhoneUnique` | chabit-identity — endpoint público de disponibilidad de teléfono |

Mientras tanto el backend puede mantenerlos como proxies o eliminarlos directamente.

### Endpoint `loginAndRequestOrganizer`

Se descompone en dos calls desde el frontend:
1. `POST /auth/sign-in` → chabit-identity
2. `POST /account/request-organizer` → chabit-identity

El endpoint combinado se elimina del backend. El frontend debe actualizarse.

### Lógica de aprobación/rechazo de organizadores

- `UserService.approveOrganizer` y `rejectOrganizer` pasan a ser delegates a `IdentityClient`
- Los endpoints `POST /user/organizer/approve/:id` y `reject/:id` se mantienen en el backend pero solo llaman al client

---

## 🟢 Dirección arquitectónica a largo plazo

La tabla `User` en el backend hoy mezcla datos de identidad (que se van a chabit-identity)
con datos operacionales del backend (CVU, alias, wallets, cards, tours).

La dirección correcta — lo que haría Google o Facebook — es eliminarla:

```
Hoy:     Tour.organizerId  → FK a User.id
         Wallet.userId     → FK a User.id
         UserArtist.userId → FK a User.id

Futuro:  Tour.organizerId  → string opaco (identity.id del JWT, sin FK)
         Wallet.userId     → string opaco
         UserArtist.userId → string opaco
```

A medida que se extraigan servicios:
- `CVU`, `alias` → servicio de finanzas
- `Card`, `StripeCustomer` → servicio de pagos
- `Wallet` → servicio de blockchain

Cuando eso ocurra, la tabla `User` desaparece naturalmente.
**No hay que hacerlo hoy** — hay que tenerlo en mente al diseñar los próximos servicios.
