# ARCHITECTURE.md — chabit-identity

> Documento vivo. Refleja el estado actual del pensamiento arquitectónico.
> Última actualización: 2026-02-26 19:15

---

## Visión

`chabit-identity` es el servicio responsable de **quién es una persona en el sistema Chabit**, cómo se autentica, y qué roles tiene.

El backend principal (`backend-chabit`) deja de saber qué es un usuario. Solo recibe tokens, los verifica, y trabaja con IDs. Toda la lógica de identidad, credenciales y cuentas vive acá.

```
cliente
   ↓
backend-chabit  (orquestador)
   ├── chabit-identity    ← este servicio
   └── chabit-ticketing
```

---

## Principios de diseño

Los mismos que rigen `chabit-ticketing`:

1. **El dominio es la fuente de verdad** — no la base de datos, no el framework, no el JWT
2. **Las invariantes viven en el dominio** — si una regla es importante, no puede quedar implícita
3. **Separación estricta por subdominios** — cada uno tiene responsabilidad propia, sin dependencias directas entre ellos
4. **El sistema modela hechos, no suposiciones** — el estado se deriva de la historia y las reglas

---

## Subdominios

El servicio está dividido en cuatro subdominios:

- **Identity** — quién es la persona
- **Credential** — cómo accede al sistema
- **Account** — qué roles tiene en el sistema
- **Verification** — proceso de verificar email/phone antes del registro

Cada subdominio es autosuficiente y no conoce detalles internos de los demás.
La comunicación entre subdominios se hace únicamente a través de puertos (ports) y referencias (refs).

---

## Estructura de carpetas

```
src/
  modules/
    identity/
    credential/
    account/
    verification/
    registration/   ← RegisterSaga + POST /register (orquestador cross-cutting)
  shared/
```

Cada módulo sigue la misma estructura interna:

```
<subdominio>/
  domain/
    entities/
    value-objects/
    policies/
    errors/
    ports/
  application/
    use-cases/
    ports/
  infrastructure/
    adapters/
    persistence/
  presentation/
    http/
```

---

## Rol de cada subdominio

### Identity

Modela a la persona física:

- Datos personales: nombre completo, email, teléfono, nacionalidad, país
- Referencia a la identidad BLNK (fintech — como adapter, no dominio)
- Estado de verificación de email

No conoce contraseñas, tokens, ni roles. Solo sabe quién es la persona.

**Invariantes:**
- El email debe estar verificado antes de crear una Identity
- Email, teléfono son únicos en el sistema

---

### Credential

Modela cómo una persona accede al sistema:

- Username, password hash, update token (refresh)
- Pertenece a una Identity (1:1)
- Emite y renueva JWTs

No conoce el rol ni el estado del usuario. Solo sabe si las credenciales son válidas.

**Invariantes:**
- El username es único en el sistema
- El update token se invalida al cambiar la contraseña
- El update token se invalida al hacer logout

**Use cases:**
- `SignIn` — valida credenciales, emite access token + update token
- `RefreshToken` — renueva el access token dado un update token válido
- `ChangePassword` — cambia la contraseña e invalida todos los tokens
- `RevokeToken` — logout explícito

---

### Account

Modela el rol que tiene una Identity dentro del sistema:

- Tipo: `USER`, `ORGANIZER`, `ADMIN`
- Status: `ACTIVE`, `PENDING`, `REJECTED`, `DEACTIVATED`
- Una Identity puede tener **múltiples Accounts** con distintos tipos

Esto permite que un organizador de eventos también sea usuario regular —
tiene `Account(ORGANIZER, ACTIVE)` y `Account(USER, ACTIVE)` bajo la misma Identity.
Ambos coexisten. El sistema no le niega la posibilidad de comprar entradas a alguien
solo porque también organiza eventos.

**Invariantes:**
- Una Identity no puede tener dos Accounts del mismo tipo
- Las transiciones de status siguen reglas estrictas:
  - `USER` → nace `ACTIVE`, puede pasar a `DEACTIVATED`
  - `ORGANIZER` → nace `PENDING`, transiciona a `ACTIVE` (aprobado) o `REJECTED`
  - `ADMIN` → solo puede ser creado por otro `ADMIN`, nace `ACTIVE`
- Un Account nunca se elimina — el "borrado" es `DEACTIVATED`

**Use cases:**
- `CreateAccount` — crea un nuevo account para una Identity
- `RequestOrganizer` — un USER solicita convertirse en ORGANIZER (crea Account ORGANIZER en PENDING)
- `ApproveOrganizer` — un ADMIN aprueba el Account ORGANIZER → ACTIVE
- `RejectOrganizer` — un ADMIN rechaza el Account ORGANIZER → REJECTED
- `GetAccountsByIdentity` — retorna todos los accounts de una Identity

---

### Verification

Modela el proceso de verificar que una persona tiene acceso real a un email (o teléfono en el futuro):

- OTP generado, hasheado y almacenado con salt
- Ciclo de vida: `pending` → `used` / `expired` / `blocked`
- Límite de intentos, cooldowns, límite por hora
- Historial de eventos (generado, verificado, intento fallido, bloqueado, etc.)

Es un prerequisito para crear una Identity. El email debe tener status `used` antes de que se permita el registro.

**Invariantes:**
- Un OTP expira si no se usa dentro de su ventana de tiempo
- Después de N intentos fallidos el código se bloquea
- Solo puede haber un proceso de verificación activo por email a la vez

**Use cases:**
- `RequestEmailVerification` — genera y envía el OTP por email
- `VerifyEmail` — valida el OTP ingresado por el usuario

---

## Shared Kernel

```
shared/
  domain/
    value-objects/
      IdentityRef.vo.ts    — referencia a una Identity desde otros subdominios
      Email.vo.ts          — email con validación de formato
      PhoneNumber.vo.ts    — teléfono con validación y código de área
    errors/
      DomainError.ts
```

**Regla:** Si un concepto puede evolucionar distinto en dos subdominios, no va en shared.

`IdentityRef` es el link entre subdominios — Credential y Account saben a qué Identity pertenecen
solo a través de este VO, nunca a través de dependencias directas.

---

## JWT

El access token emitido por Credential tiene la siguiente estructura:

```json
{
  "sub": "<identity-id>",
  "sid": "<session-id>",
  "username": "nobel",
  "accounts": [
    { "id": "<account-id>", "type": "USER",      "status": "ACTIVE" },
    { "id": "<account-id>", "type": "ORGANIZER", "status": "ACTIVE" }
  ],
  "iat": 1234567890,
  "exp": 1234571490
}
```

- **`sub`** — identity ID. Preserva el UUID del `User` actual durante la migración.
- **`sid`** — session ID. No se verifica en cada request (el backend sigue siendo stateless), pero está disponible para invalidación inmediata si en el futuro se necesita.
- **`accounts`** — reemplaza al campo `role` actual. Solo se incluyen accounts con `status: ACTIVE`. Accounts en PENDING, REJECTED o DEACTIVATED no viajan en el token — el JWT es para autorización, no para estado de cuenta. El backend verifica tipo + status para autorizar.
- **TTL del access token: 15 minutos.** Corto por diseño — limita la ventana de exposición ante tokens robados o accounts desactualizados (ej: organizer desactivado).

El backend consume este token y sabe qué puede hacer el usuario según sus accounts.
No necesita llamar a `chabit-identity` en cada request — verifica el JWT localmente
con el secret compartido. Esto mantiene la performance sin acoplamiento por request.

**Nota de migración — backend:**
El `AuthGuard` y `RolesGuard` actuales leen `request.user.role` (string único).
Con el nuevo JWT, deben leer `request.user.accounts` y verificar si existe un account
del tipo requerido con `status: ACTIVE`. Esta migración ocurre en el backend
al momento del despliegue de `chabit-identity` y es un cambio breaking — requiere coordinación.

---

## Comunicación con el backend

- HTTP + API key (igual que `chabit-ticketing`)
- El backend tiene un `IdentityClient` que encapsula todas las llamadas al servicio
- Endpoints públicos (sin API key): sign-in, refresh-token, register, verify-email
- Endpoints internos (con API key): approve/reject organizer, get identity por ID

---

## Tareas pendientes en el backend

Ver [`BACKEND_MIGRATION.md`](./BACKEND_MIGRATION.md) — documento separado con todos los cambios necesarios en `backend-chabit`, divididos en breaking (al deploy), no breaking (post-deploy) y dirección arquitectónica a largo plazo.

---

## Lo que queda fuera de este servicio

| Concepto | Dónde vive |
|----------|------------|
| Wallet / CVU / Alias | Servicio de finanzas (futuro) o backend |
| Tarjetas / Stripe | Servicio de pagos (futuro) o backend |
| Staff auth | Backend o chabit-ticketing (actor operacional, no tiene Identity propia) |
| BLNK identity | Adapter dentro de Identity (infraestructura) |
| Preferencias de usuario (UserArtist) | Backend o servicio de perfil (futuro) |

---

## Modelo de datos

```sql
-- Quién es la persona
CREATE TABLE identities (
  id              UUID PRIMARY KEY,
  full_name       TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  phone           TEXT UNIQUE NOT NULL,
  nationality     TEXT NOT NULL,
  country         TEXT NOT NULL,
  blnk_identity_id TEXT UNIQUE,
  email_verified_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cómo accede al sistema (1:1 con Identity)
CREATE TABLE credentials (
  id                  UUID PRIMARY KEY,
  identity_id         UUID UNIQUE NOT NULL REFERENCES identities(id),
  username            TEXT UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  username_changed_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sesiones activas (1:N con Credential)
CREATE TABLE sessions (
  id           UUID PRIMARY KEY,
  credential_id UUID NOT NULL REFERENCES credentials(id),
  update_token  TEXT UNIQUE NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,      -- sliding: now() + 30d, se renueva en cada refresh
  user_agent    TEXT,                      -- "iPhone / Safari 17" — auditoría / gestión de sesiones
  ip_address    TEXT,                      -- IP de creación — auditoría
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_update_token  ON sessions(update_token);
CREATE INDEX idx_sessions_credential_id ON sessions(credential_id);

-- Qué roles tiene (1:N con Identity)
CREATE TABLE accounts (
  id              UUID PRIMARY KEY,
  identity_id     UUID NOT NULL REFERENCES identities(id),
  type            TEXT NOT NULL CHECK (type IN ('USER', 'ORGANIZER', 'ADMIN')),
  status          TEXT NOT NULL CHECK (status IN ('ACTIVE', 'PENDING', 'REJECTED', 'DEACTIVATED')),
  created_by      UUID REFERENCES identities(id),   -- solo para ADMIN — quién lo creó
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_identity_account_type UNIQUE (identity_id, type)
);

-- Verificación de email
CREATE TABLE email_verifications (
  id              SERIAL PRIMARY KEY,
  identity_id     UUID REFERENCES identities(id), -- nullable hasta que se crea la Identity
  email           TEXT NOT NULL,
  otp_hash        TEXT NOT NULL,
  otp_salt        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'USED', 'EXPIRED', 'BLOCKED')),
  attempts        INT NOT NULL DEFAULT 0,
  max_attempts    INT NOT NULL DEFAULT 5,
  expires_at      TIMESTAMPTZ NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at         TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Nota: status en UPPERCASE para consistencia con el resto del sistema y el índice parcial

-- Historial de eventos de verificación
CREATE TABLE email_events (
  id              SERIAL PRIMARY KEY,
  email           TEXT NOT NULL,
  type            TEXT NOT NULL,   -- requested, verified, attempt_failed, expired, blocked, ...
  metadata        JSONB,
  verification_id INT REFERENCES email_verifications(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Migración desde el monolito

Cada `User` en el backend actual se convierte en:

| User actual | Identity | Credential | Account(s) |
|-------------|----------|------------|------------|
| role: USER, status: ACTIVE | ✓ | ✓ | USER (ACTIVE) |
| role: ORGANIZER, status: APPROVED | ✓ | ✓ | ORGANIZER (ACTIVE) + USER (ACTIVE) |
| role: ORGANIZER, status: PENDING | ✓ | ✓ | ORGANIZER (PENDING) + USER (ACTIVE) |
| role: ORGANIZER, status: REJECTED | ✓ | ✓ | ORGANIZER (REJECTED) + USER (ACTIVE) |
| role: ADMIN | ✓ | ✓ | ADMIN (ACTIVE) |

**Sobre los IDs:**
Los UUIDs de `User` se preservan como `identity.id`.
`chabit-ticketing` usa `organizerRef` como string — ese string sigue siendo válido
porque apunta al mismo UUID que ahora es `identity.id`.

---

---

## Value Objects por subdominio

### Identity

#### Locales

**`IdentityId`**
- UUID v4, generado al crear la Identity
- Inmutable
- Es el ID que otros servicios usan como referencia (`organizerRef` en ticketing apunta a este valor)

---

**`FullName`**
- Representa el nombre completo de la persona
- Reglas:
  - `trim()` al construir
  - No puede ser vacío
  - Máximo 150 caracteres
  - Caracteres permitidos: letras (incluyendo acentos), espacios, guiones (`-`), apóstrofes (`'`)
- Ejemplos válidos: `García-López`, `O'Brien`, `Nobel Pérez`
- La separación en `firstName` / `lastName` es responsabilidad del adapter de BLNK (infraestructura), no del dominio

---

**`Nationality`**
- Representa la nacionalidad declarada de la persona
- Reglas:
  - `trim()` al construir
  - No puede ser vacío
  - Máximo 100 caracteres
  - Caracteres permitidos: letras, espacios, guiones
- Validación contra lista de países válidos: responsabilidad de la capa de aplicación (policy), no del VO
- El VO acepta cualquier string bien formado

---

**`Country`**
- Representa el país de residencia de la persona
- Mismas reglas que `Nationality`
- Mismo criterio: el VO valida formato, la policy valida si es un país reconocido

---

**`BlnkIdentityRef`**
- Referencia opaca al sistema BLNK (fintech externo)
- String no vacío
- El dominio no conoce su formato interno — es una referencia externa
- Puede ser `undefined` hasta que se complete la integración con BLNK
- Inmutable una vez asignado

---

#### Candidatos a Shared Kernel

**`IdentityRef`**
- Referencia a una Identity desde otros subdominios (Credential, Account)
- Encapsula un UUID string — el subdominio que lo usa no conoce los internos de Identity
- Inmutable
- Mismo patrón que `organizerRef` en `chabit-ticketing`
- Va en `shared/domain/value-objects/`

---

**`Email`**
- Usado por Identity y por Verification con la misma semántica y validación
- Reglas:
  - `trim().toLowerCase()` al construir
  - Formato válido de email (RFC básico: contiene `@`, dominio con al menos un punto)
  - Máximo 254 caracteres (límite RFC 5321)
- Va en `shared/domain/value-objects/`

---

**`PhoneNumber`**
- Hoy solo lo usa Identity, pero si Verification agrega OTP por SMS lo necesita igual
- Reglas:
  - Solo dígitos y opcionalmente `+` al inicio
  - Mínimo 7, máximo 15 dígitos (estándar E.164)
  - No incluye el código de área en el VO — se resuelve en la capa de presentación o aplicación
- Va en `shared/domain/value-objects/`

---

### Identity — Entidad

**`Identity`** es el aggregate root del subdominio. No tiene estados propios — existe o no existe.

**Factory method `create`:**
- Recibe: `id`, `fullName`, `email`, `phone`, `nationality`, `country`, `emailVerifiedAt: Date`
- Valida que `emailVerifiedAt` no sea null — la entidad no hace IO, no consulta si el email está verificado; esa responsabilidad es del use case
- El email es **inmutable** desde el momento de creación — es la clave de identidad
- `blnkIdentityRef` nace como `undefined`

**Operaciones:**

`assignBlnkRef(ref: BlnkIdentityRef): void`
- Solo disponible si `blnkIdentityRef` es `undefined`
- Una vez asignado, inmutable
- Lanza `BlnkRefAlreadyAssignedError` si ya existe

`updateProfile(props: { fullName?, phone?, nationality?, country? }): void`
- Campos mutables: `fullName`, `phone`, `nationality`, `country`
- Sin restricciones de estado (Identity no tiene status propio)
- Cada campo se valida con su VO correspondiente

**Invariantes:**
- `email` es inmutable — cambiar de email es un proceso separado (re-verificación), no un `updateProfile`
- `blnkIdentityRef` es inmutable una vez asignado
- `emailVerifiedAt` debe ser un Date válido al momento de creación

---

### Identity — Errors

| Error | Cuándo |
|-------|--------|
| `IdentityNotFoundError` | Se busca una Identity que no existe |
| `EmailAlreadyRegisteredError` | Se intenta crear una Identity con un email ya registrado |
| `PhoneAlreadyRegisteredError` | Se intenta crear una Identity con un teléfono ya registrado |
| `EmailNotVerifiedError` | Se intenta crear una Identity sin `emailVerifiedAt` |
| `BlnkRefAlreadyAssignedError` | Se intenta reasignar el `blnkIdentityRef` |

---

### Identity — Compensación de saga

`DeleteIdentity` es un **hard delete**. Se usa exclusivamente como compensación dentro de `RegisterSaga` cuando un step posterior falla (Step 2 o Step 3).

Justificación: la Identity que se elimina nunca llegó a completarse — no tiene Credential ni Account asociados. No hay nada que preservar. Un soft delete agregaría complejidad sin beneficio en este caso.

`DeleteIdentity` **no está disponible** como operación general del dominio — solo existe como port de compensación dentro de la saga.

---

### Identity — Unicidad en UpdateProfile

Si se actualiza `phone`, el use case verifica con `findByPhone` antes de guardar.
Si el teléfono ya existe → `PhoneAlreadyRegisteredError`.

La DB constraint (`UNIQUE`) actúa como última línea de defensa ante race conditions.
El use case no garantiza atomicidad — la garantía real la da la constraint.

Mismo patrón que usa el backend hoy en `UserService.update()`.

---

### Identity — Vínculo con Verification

Al completar el Step 1 de `RegisterSaga` (Identity creada), la saga ejecuta un sub-step:

```
Sub-step 1a: LinkVerificationToIdentity(verificationId, identityId)
  → Verification: actualiza identity_id en email_verifications
  → fallo: tolerado — es auditoría, no invariante de negocio
  → sin compensación
```

La saga ya tiene el `verificationId` como input — lo usó para la guarda previa.
Identity no llama directamente a Verification — la saga orquesta ambos.

---

### Identity — GetIdentity vs GetProfile

**`GetIdentity`** — use case del dominio, devuelve solo datos de la persona:
```
{ id, fullName, email, phone, nationality, country, emailVerifiedAt }
```

**`GetProfile`** — endpoint en la capa de presentación, agrega Identity + Accounts:
```
GET /profile
→ {
    identity: { id, fullName, email, phone, ... },
    accounts: [
      { id, type: "USER",      status: "ACTIVE" },
      { id, type: "ORGANIZER", status: "ACTIVE" }
    ]
  }
```
El `identityId` se extrae del JWT — el usuario solo puede ver su propio perfil desde este endpoint.
Para ver el perfil de otra Identity → `GET /internal/identity/:id/accounts` (API key).

No viola DDD — el agregado ocurre en presentación, no en el dominio.
El backend llama a un solo endpoint para tener el perfil completo.

---

### Identity — Eventos de dominio

Pendiente de definir. Emergen cuando se diseñen los use cases completos de los otros subdominios y se vea si algo necesita consumirlos.

---

### Identity — Ports

**`IdentityRepository`**
```
save(identity: Identity): Promise<void>
findById(id: IdentityId): Promise<Identity | null>
findByEmail(email: Email): Promise<Identity | null>
findByPhone(phone: PhoneNumber): Promise<Identity | null>
hardDelete(id: IdentityId): Promise<void>   ← solo para compensación de saga
```

**`IdentityId.generator`**
```
generate(): IdentityId
```

---

---

## Flujos

### Flujo de registro

Coordina cuatro subdominios. Orquestado por una **saga** con compensaciones — si falla cualquier paso, se deshacen los anteriores.

```
Cliente
  ↓
1. POST /verification/email         → Verification: genera y envía OTP
2. POST /verification/email/verify  → Verification: valida OTP → status: used
  ↓
3. POST /register                   → RegisterSaga
```

**RegisterSaga:**

```
Step 1: CreateIdentity
  input:  fullName, email, phone, nationality, country, emailVerifiedAt  ← emailVerifiedAt viene de la guarda
  output: identityId
  compensación: DeleteIdentity(identityId)

Sub-step 1a: LinkVerificationToIdentity  ← fire & forget, no bloquea
  input:  verificationId, identityId
  fallo:  tolerado — auditoría, sin compensación

Step 2: CreateCredential
  input:  identityId, username, password
  output: credentialId
  compensación: DeleteCredential(credentialId)

Step 3: CreateAccount(USER, ACTIVE)
  input:  identityId
  output: accountId
  compensación: DeleteAccount(accountId)

Step 4: AssignBlnkRef         ← fire & forget, no bloquea el registro
  input:  identityId, fullName, email, phone, country, nationality
  output: blnkIdentityRef
  fallo:  tolerado — se encola para reintento async, no compensa nada
  TODO:   el mecanismo de cola (BullMQ u otro) no está definido aún — se diseña al implementar la integración BLNK

Step 5: SignIn                ← emite los tokens finales
  input:  username, password
  output: accessToken + updateToken
  compensación: ninguna (no persiste estado)
```

**Reglas de compensación:**
- Falla en Step 2 → compensa Step 1 (DeleteIdentity)
- Falla en Step 3 → compensa Step 2 (DeleteCredential) → compensa Step 1 (DeleteIdentity)
- Falla en Step 4 → no compensa nada, se reintenta en background
- Falla en Step 5 → no compensa nada (el usuario ya existe, puede hacer `POST /auth/sign-in`)
  El cliente recibe un error 500. Si reintenta `POST /register` recibirá `EMAIL_ALREADY_REGISTERED`
  o `USERNAME_ALREADY_TAKEN` — señales de que el registro existió. El cliente debe guiar al usuario
  a `POST /auth/sign-in` en ese caso. Documentar esto en el frontend.

**Orden de FK — por qué el orden de compensación es seguro:**

```
sessions     → FK → credentials → FK → identities
accounts                        → FK → identities
```

El orden de compensación respeta las FKs:
1. `DeleteCredential` (Step 2) — seguro porque en este punto no hay Sessions creadas
   (Sessions solo se crean en Step 5, que aún no ejecutó)
2. `DeleteIdentity` (Step 1) — seguro porque Credential ya fue eliminada y
   Account nunca llegó a crearse (Step 3 falló = `save(account)` nunca completó)

**Nunca eliminar Identity antes que Credential o Account** — violaría las FK constraints.
Si algún día se agregan Steps que crean Sessions antes del Step 5, este análisis debe revisarse.

**Prerrequisito:**
Antes de ejecutar la saga, el use case verifica la prueba de verificación de email.
El cliente recibió `verificationId` al completar `VerifyEmail` y lo incluye en el body de `POST /register`.

Esta verificación ocurre fuera de la saga — es una guarda, no un step compensable.

```
verification = findById(verificationId)                          ← el cliente provee el ID
si no existe → EmailNotVerifiedError
si verification.status !== 'used' → EmailNotVerifiedError
si verification.email !== email del registro → EmailNotVerifiedError  ← previene uso cruzado
emailVerifiedAt = verification.usedAt                            ← se pasa a Step 1
```

**Por qué `findById` y no `findUsedByEmail`:**
Un email puede tener múltiples registros USED históricos (si el usuario pasó por el flujo varias veces). Buscar por email es ambiguo. El cliente presenta su `verificationId` como prueba — es más preciso, más seguro, y elimina la necesidad de un método adicional en el port.

---

### Identity — Use Cases

| Use Case | Responsabilidad |
|----------|----------------|
| `CreateIdentity` | Crea la Identity. Valida que el email esté verificado. Usado internamente por RegisterSaga. |
| `GetIdentity` | Retorna los datos de una Identity por ID. Usado por el backend y otros servicios. |
| `UpdateProfile` | Actualiza fullName, phone, nationality, country. Requiere autenticación. |
| `AssignBlnkRef` | Asigna la referencia BLNK. Usado por RegisterSaga en Step 4. |

---

---

---

### Credential — Value Objects

#### `CredentialId`
- UUID v4, generado al crear la Credential
- Inmutable

---

#### `Username`
- Reglas:
  - `trim().toLowerCase()` al construir
  - Mínimo 3, máximo 30 caracteres
  - Caracteres permitidos: letras (`a-z`), números (`0-9`), guión bajo (`_`), guión (`-`)
  - No puede empezar ni terminar con guión o guión bajo
  - Sin espacios, sin puntos, sin caracteres especiales
- Regex: `^[a-z0-9]([a-z0-9_-]{1,28}[a-z0-9])?$`
- Ejemplos válidos: `nobel`, `eco_dev`, `user-123`, `abc`
- Ejemplos inválidos: `_nobel`, `eco.dev`, `ab`, `a_very_very_long_username_here_xxx`
- URL-friendly por diseño — mismo estándar que GitHub y Twitter

---

#### `RawPassword`
- Solo para input del usuario — **nunca se persiste**
- Reglas:
  - Mínimo 8 caracteres
  - Máximo 128 caracteres
  - No puede ser solo espacios en blanco
- No se imponen reglas de complejidad (mayúscula, símbolo, etc.) — la longitud es el factor principal de seguridad

---

#### `PasswordHash`
- String opaco resultado de hashear un `RawPassword`
- El dominio lo trata como caja negra — no conoce el algoritmo
- Inmutable una vez creado
- Solo vive en el aggregate `Credential` y nunca se expone fuera de la capa de dominio

---

#### `UpdateToken`
- UUID v4, generado al crear o rotar una Session
- Se almacena en plain text (no hasheado) — la entropía del UUID v4 (122 bits) es suficiente
- Pertenece a `Session`, no a `Credential`

---

#### `SessionId`
- UUID v4, generado al crear la Session
- Inmutable
- Es el `sid` que viaja en el JWT

---

### Credential — Entidad `Session`

**`Session`** es una entidad dentro del subdominio Credential. No es un aggregate root propio — vive bajo la Credential.

**Factory method `create`:**
- Recibe: `id: SessionId`, `credentialId: CredentialId`, `updateToken: UpdateToken`, `userAgent?: string`, `ipAddress?: string`
- `expires_at` = `now() + 30 días`
- `last_used_at` = `now()`

**Operaciones:**

`rotate(newToken: UpdateToken): void`
- Reemplaza el update token
- Extiende `expires_at` a `now() + 30 días` (sliding window)
- Actualiza `last_used_at`

`isExpired(): boolean`
- Retorna `true` si `expires_at < now()`

**Invariantes:**
- Una Session expirada no puede ser rotada — el use case verifica `isExpired()` antes de rotar

---

### Credential — Entidad

**`Credential`** es el aggregate root del subdominio. Ya no gestiona tokens directamente — esa responsabilidad vive en `Session`.

**Factory method `create`:**
- Recibe: `id: CredentialId`, `identityRef: IdentityRef`, `username: Username`, `passwordHash: PasswordHash`
- `usernameChangedAt` nace como `undefined`

**Operaciones:**

`updatePassword(newHash: PasswordHash): void`
- Actualiza `passwordHash`
- No toca sesiones — es responsabilidad del use case eliminarlas

`changeUsername(newUsername: Username): void`
- Actualiza `username`
- Registra `usernameChangedAt` con la fecha actual

**Invariantes:**
- `username` es inmutable salvo mediante `changeUsername` — no hay setter directo
- `passwordHash` solo se actualiza vía `updatePassword` — no hay setter directo

---

### Credential — Errors

| Error | Cuándo |
|-------|--------|
| `CredentialNotFoundError` | Se busca una Credential que no existe |
| `InvalidCredentialsError` | Username o contraseña incorrectos (deliberadamente genérico — no revela cuál falló) |
| `SessionNotFoundError` | El update token no corresponde a ninguna sesión activa |
| `SessionExpiredError` | La sesión existe pero su `expires_at` ya pasó |
| `UsernameAlreadyTakenError` | Se intenta crear o cambiar a un username ya registrado |
| `UsernameReservedError` | El username está en la lista de nombres reservados |
| `CannotChangeUsernameYetError` | Intento de cambio de username antes de que transcurran los 30 días desde el último cambio |

---

### Credential — Ports

**`CredentialRepository`**
```
save(credential: Credential): Promise<void>
findById(id: CredentialId): Promise<Credential | null>
findByUsername(username: Username): Promise<Credential | null>
findByIdentityRef(ref: IdentityRef): Promise<Credential | null>
hardDelete(id: CredentialId): Promise<void>   ← solo para compensación de saga
```

**`SessionRepository`**
```
save(session: Session): Promise<void>
findByUpdateToken(token: UpdateToken): Promise<Session | null>
findAllByCredentialId(credentialId: CredentialId): Promise<Session[]>
deleteById(id: SessionId): Promise<void>
deleteAllByCredentialId(credentialId: CredentialId): Promise<void>
deleteAllByCredentialIdExcept(credentialId: CredentialId, exceptSessionId: SessionId): Promise<void>
deleteExpiredByCredentialId(credentialId: CredentialId): Promise<void>
countActiveByCredentialId(credentialId: CredentialId): Promise<number>
deleteOldestByCredentialId(credentialId: CredentialId): Promise<void>
```

**Notas de implementación:**
- `countActiveByCredentialId` — "active" = `expires_at > now()`. Solo cuenta sesiones no expiradas. Las expiradas no se consideran aunque persistan en la tabla.
- `deleteOldestByCredentialId` — elimina la sesión con `last_used_at` más antiguo (LRU). Eviccionamos la que hace más tiempo que nadie usa, no la que se creó primero. Es el criterio más justo para el usuario.
- **Nota arquitectónica:** el límite de 10 sesiones es un safety valve operacional, no una regla de negocio permanente. A medida que el sistema escale, puede reemplazarse por rate limiting en el endpoint de `SignIn`. No modelar como invariante de dominio.

**`PasswordHasher`**
```
hash(raw: RawPassword): Promise<PasswordHash>
compare(raw: RawPassword, hash: PasswordHash): Promise<boolean>
```

**`TokenService`**
```
generateAccessToken(payload: AccessTokenPayload): string
generateUpdateToken(): UpdateToken
generateSessionId(): SessionId
```

**`AccountQueryPort`** ← cross-subdominio, solo lectura
```
getAccountsByIdentityRef(ref: IdentityRef): Promise<AccountSnapshot[]>
```
Permite a Credential construir el payload del JWT sin acoplarse al subdominio Account.
`AccountSnapshot = { id: string; type: AccountType; status: AccountStatus }`

**`UsernameReservedList`**
```
isReserved(username: Username): boolean
```
Lista mantenida como constante en infraestructura. Incluye como mínimo: `admin`, `api`, `www`, `mail`, `root`, `null`, `undefined`, `me`, `settings`, `help`, `support`, `about`, `login`, `logout`, `signup`, más todos los segmentos de ruta reales de la app.

---

### Credential — Use Cases

| Use Case | Responsabilidad |
|----------|----------------|
| `CreateCredential` | Crea la Credential. Solo usado por RegisterSaga (Step 2). |
| `SignIn` | Valida username + password, crea una Session, emite access token + update token |
| `RefreshToken` | Rota el update token de una Session, emite nuevo access token |
| `ChangePassword` | Cambia la contraseña, elimina todas las sesiones excepto la actual |
| `RevokeToken` | Logout explícito — elimina la Session específica |
| `RevokeAllTokens` | Logout global — elimina todas las Sessions de la Credential |
| `ChangeUsername` | Cambia el username respetando el período de cooldown |

---

#### `CreateCredential`

```
1. isReserved(username)                                      → si true → UsernameReservedError
2. findByUsername(username)                                  → si existe → UsernameAlreadyTakenError
3. hash(rawPassword)                                         → passwordHash
4. Credential.create(id, identityRef, username, passwordHash)
5. save(credential)
```

Solo disponible internamente — no expuesto como endpoint público. La saga lo invoca directamente.

---

#### `SignIn`

```
1. findByUsername(username)                                  → si no existe → InvalidCredentialsError
2. compare(rawPassword, credential.passwordHash)             → si false → InvalidCredentialsError
3. deleteExpiredByCredentialId(credential.id)                ← limpieza on-login
4. countActiveByCredentialId(credential.id)                  → si >= 10, deleteOldestByCredentialId(credential.id)
5. getAccountsByIdentityRef(credential.identityRef)          → AccountSnapshot[]
6. sessionId = generateSessionId()
7. updateToken = generateUpdateToken()
8. Session.create(sessionId, credential.id, updateToken, userAgent, ipAddress)
9. save(session)
10. generateAccessToken({ sub: identityRef, sid: sessionId, username, accounts })
11. return { accessToken, updateToken }
```

El error es siempre `InvalidCredentialsError` — no se distingue entre "usuario no existe" y "contraseña incorrecta" para no filtrar información al atacante.

El paso 4 elimina silenciosamente la sesión más antigua si se supera el límite de 10 — sin error, sin fricción.

---

#### `RefreshToken`

```
1. findByUpdateToken(token)                                  → si no existe → SessionNotFoundError
2. si session.isExpired()                                    → SessionExpiredError
3. findById(session.credentialId)                            → Credential (para identityRef + username)
4. getAccountsByIdentityRef(credential.identityRef)          → AccountSnapshot[]
5. newUpdateToken = generateUpdateToken()
6. session.rotate(newUpdateToken)                            ← nuevo token + extends expires_at
7. save(session)
8. generateAccessToken({ sub: credential.identityRef, sid: session.id, username: credential.username, accounts })
9. return { accessToken, updateToken: newUpdateToken }
```

**Rotación de tokens:** cada refresh invalida el token anterior. Si un token robado se usa después de un refresh legítimo, el atacante obtiene `SessionNotFoundError`. El cliente legítimo también pierde la sesión — debe hacer sign-in. Es el trade-off correcto para este sistema.

---

#### `ChangePassword`

```
1. findByIdentityRef(identityRef)                            ← viene del JWT verificado
2. compare(currentPassword, credential.passwordHash)         → si false → InvalidCredentialsError
3. hash(newPassword)                                         → newHash
4. credential.updatePassword(newHash)
5. save(credential)
6. deleteAllByCredentialIdExcept(credential.id, sessionId)   ← sessionId = sid del JWT actual
```

Mata todas las sesiones de otros dispositivos. Mantiene la sesión actual activa — el usuario ya probó que conoce la contraseña en este dispositivo.

---

#### `RevokeToken`

```
1. deleteById(sessionId)   ← sessionId = sid del JWT actual. POST /auth/sign-out no tiene body.
```

Logout de un dispositivo específico. Si la sesión ya no existe, la operación es idempotente.
El `sid` del JWT identifica unívocamente la sesión — no necesita buscarla antes de borrarla.

---

#### `RevokeAllTokens`

```
1. findByIdentityRef(identityRef)                            ← viene del JWT verificado
2. deleteAllByCredentialId(credential.id)
```

Logout global — útil para "cerrar sesión en todos los dispositivos".

---

#### `ChangeUsername`

```
1. findByIdentityRef(identityRef)                            ← viene del JWT verificado
2. Si usernameChangedAt && ahora < usernameChangedAt + 30d  → CannotChangeUsernameYetError
3. isReserved(newUsername)                                   → si true → UsernameReservedError
4. findByUsername(newUsername)                               → si existe → UsernameAlreadyTakenError
5. credential.changeUsername(newUsername)
6. save(credential)
```

**Nota sobre el JWT:** el access token sigue siendo válido con el username viejo hasta que expire (máx 15 min). El cliente debe llamar a `RefreshToken` inmediatamente después para obtener un JWT actualizado. No se invalidan las sesiones — la fricción no justifica el beneficio dado el TTL corto.

---

### Credential — Modelo de datos

El modelo de datos completo para este subdominio está definido en la sección principal. Incluye `credentials` (con `username_changed_at`) y `sessions` (con índices). No se requieren ajustes adicionales.

---

### Credential — Vínculo con RegisterSaga

`CreateCredential` (Step 2 de la saga) crea la Credential sin update token.
El Step 5 (`SignIn`) es el primer use case que asigna el update token.

La compensación `DeleteCredential` es un hard delete — misma justificación que `DeleteIdentity`: la Credential nunca llegó a completarse, no hay nada que preservar.

---

---

---

### Account — Value Objects

#### `AccountId`
- UUID v4, generado al crear el Account
- Inmutable

---

#### `AccountType`
- Enum: `USER | ORGANIZER | ADMIN`
- Determina el rol de la persona dentro del sistema
- Inmutable desde la creación — no se puede cambiar el tipo de un Account

---

#### `AccountStatus`
- Enum: `ACTIVE | PENDING | REJECTED | DEACTIVATED`
- `ACTIVE` — operativo. Es el único status que viaja en el JWT.
- `PENDING` — esperando aprobación manual (solo ORGANIZER).
- `REJECTED` — solicitud rechazada. Permite re-solicitud.
- `DEACTIVATED` — desactivado manualmente. Reversible.
- **Nota:** `APPROVED` fue eliminado intencionalmente. Todos los accounts operativos tienen `status: ACTIVE`, independientemente de si requirieron aprobación. El `type` ya captura si pasaron por ese proceso.

---

### Account — Entidad

**`Account`** es el aggregate root del subdominio. Modela el rol que tiene una Identity dentro del sistema.

**Factory methods:**

`Account.createUser(id: AccountId, identityRef: IdentityRef): Account`
- Nace con `status: ACTIVE`
- `createdBy` es `undefined`

`Account.createOrganizer(id: AccountId, identityRef: IdentityRef): Account`
- Nace con `status: PENDING`
- `createdBy` es `undefined`

`Account.createAdmin(id: AccountId, identityRef: IdentityRef, createdBy: IdentityRef): Account`
- Nace con `status: ACTIVE`
- `createdBy` es el IdentityRef del ADMIN que lo creó — auditoría desde el nacimiento

**Operaciones:**

`approve(): void`
- Solo disponible si `type === ORGANIZER` y `status === PENDING`
- Transición: `PENDING → ACTIVE`
- Lanza `InvalidStatusTransitionError` si no se cumplen las condiciones

`reject(): void`
- Solo disponible si `type === ORGANIZER` y `status === PENDING`
- Transición: `PENDING → REJECTED`
- Lanza `InvalidStatusTransitionError` si no se cumplen las condiciones

`reRequest(): void`
- Solo disponible si `type === ORGANIZER` y `status === REJECTED`
- Transición: `REJECTED → PENDING`
- Lanza `InvalidStatusTransitionError` si no se cumplen las condiciones

`deactivate(): void`
- Disponible si `status === ACTIVE`
- Transición: `ACTIVE → DEACTIVATED`
- Lanza `InvalidStatusTransitionError` si no se cumplen las condiciones

`reactivate(): void`
- Disponible si `status === DEACTIVATED`
- Transición: `DEACTIVATED → ACTIVE`
- Lanza `InvalidStatusTransitionError` si no se cumplen las condiciones

**Matriz de transiciones completa:**

| Tipo | Desde | Hacia | Operación |
|------|-------|-------|-----------|
| USER | ACTIVE | DEACTIVATED | deactivate() |
| USER | DEACTIVATED | ACTIVE | reactivate() |
| ORGANIZER | PENDING | ACTIVE | approve() |
| ORGANIZER | PENDING | REJECTED | reject() |
| ORGANIZER | REJECTED | PENDING | reRequest() |
| ORGANIZER | ACTIVE | DEACTIVATED | deactivate() |
| ORGANIZER | DEACTIVATED | ACTIVE | reactivate() |
| ADMIN | ACTIVE | DEACTIVATED | deactivate() |
| ADMIN | DEACTIVATED | ACTIVE | reactivate() |

Cualquier transición fuera de esta tabla → `InvalidStatusTransitionError`.

**Invariantes:**
- `type` es inmutable
- `createdBy` solo es relevante para `ADMIN` — para `USER` y `ORGANIZER` es `undefined`
- Un Account nunca se elimina en condiciones normales — el "borrado" es `DEACTIVATED`
- La excepción es la compensación de saga: un Account recién creado que nunca llegó a completarse puede hard-deletearse (ver sección de compensación)

---

### Account — Errors

| Error | Cuándo |
|-------|--------|
| `AccountNotFoundError` | Se busca un Account que no existe |
| `AccountAlreadyExistsError` | Se intenta crear un Account de un tipo que la Identity ya tiene |
| `InvalidStatusTransitionError` | Se intenta una transición de status no válida |
| `InsufficientPermissionsError` | El caller no tiene los permisos necesarios para ejecutar la operación (ej: no-ADMIN intentando aprobar, rechazar, desactivar, o crear un ADMIN) |

---

### Account — Compensación de saga

`DeleteAccount` (Step 3 de RegisterSaga) es un **hard delete** de excepción.

Justificación: el Account de compensación nació hace milisegundos dentro de un registro fallido. No tiene historia, no tiene actividad, no representa a nadie. Es un artefacto de transacción, no un dato de negocio.

**El principio "datos son oro" aplica a accounts reales** — aquellos con historial, con actividad, con significado. Un Account que nunca llegó a existir funcionalmente no es un dato que preservar.

Esta operación **no está disponible** como operación general del sistema — solo existe como port de compensación dentro de la saga.

---

### Account — Ports

**`AccountRepository`**
```
save(account: Account): Promise<void>
findById(id: AccountId): Promise<Account | null>
findByIdentityRef(ref: IdentityRef): Promise<Account[]>
findByIdentityRefAndType(ref: IdentityRef, type: AccountType): Promise<Account | null>
findActiveByIdentityRef(ref: IdentityRef): Promise<Account[]>   ← solo status: ACTIVE, para el JWT
hardDelete(id: AccountId): Promise<void>                        ← solo para compensación de saga
```

**`AccountQueryPort`** — ya definido en Credential (cross-subdominio, solo lectura)
```
getAccountsByIdentityRef(ref: IdentityRef): Promise<AccountSnapshot[]>
```
Implementado por el adaptador del subdominio Account. Devuelve solo accounts con `status: ACTIVE`.
`AccountSnapshot = { id: string; type: AccountType; status: AccountStatus }`

**`AccountEventRepository`**
```
save(event: { accountId: AccountId; type: AccountEventType; performedBy?: IdentityRef; metadata?: Record<string, unknown> }): Promise<void>
```
`AccountEventType = 'created' | 'approved' | 'rejected' | 're_requested' | 'deactivated' | 'reactivated'`
Los use cases llaman a este port de forma fire & forget — el fallo es tolerado.

---

### Account — Bootstrap del primer ADMIN

La invariante "solo un ADMIN puede crear otro ADMIN" necesita una salida para el primer deployment.

**Solución: seed script**
```
npm run seed:admin -- --username <username> --password <password>
```
El script crea directamente en la DB la Identity, Credential y Account(ADMIN, ACTIVE) correspondientes, bypasseando la guarda de `InsufficientPermissionsError`. Es una operación de una sola vez por environment, documentada, sin exposición en el HTTP layer.

**No existe un endpoint de bootstrap** — evita el riesgo de que quede habilitado en producción.

---

### Account — Use Cases

| Use Case | ¿Quién puede llamarlo? | Responsabilidad |
|----------|----------------------|----------------|
| `CreateAccount` | Interno (saga) — no expuesto | Crea un Account. Usado internamente por RegisterSaga (Step 3). |
| `RequestOrganizer` | El propio usuario autenticado (USER ACTIVE) | Solicita convertirse en ORGANIZER. Crea Account(ORGANIZER, PENDING). |
| `ApproveOrganizer` | Solo ADMIN | Aprueba → PENDING → ACTIVE. |
| `RejectOrganizer` | Solo ADMIN | Rechaza → PENDING → REJECTED. |
| `ReRequestOrganizer` | El dueño del account REJECTED (identityRef del JWT debe coincidir) | Re-solicita → REJECTED → PENDING. |
| `DeactivateAccount` | Solo ADMIN | Desactiva → ACTIVE → DEACTIVATED. No es self-service — es moderación. |
| `ReactivateAccount` | Solo ADMIN | Reactiva → DEACTIVATED → ACTIVE. |
| `GetAccountsByIdentity` | El propio usuario (solo sus accounts) o ADMIN (cualquier identity) | Retorna todos los accounts de una Identity (todos los statuses). |

**Nota de autorización:** la verificación de quién puede llamar cada use case ocurre en la capa de aplicación, no en el dominio. Cada use case recibe el `callerRef: IdentityRef` del JWT (extraído por el guard) y verifica el permiso antes de ejecutar la lógica de negocio.

---

#### `CreateAccount`

```
1. findByIdentityRefAndType(identityRef, type)     → si existe → AccountAlreadyExistsError
2. si type === ADMIN: verificar que callerRef tenga Account(ADMIN, ACTIVE)
   → si no → InsufficientPermissionsError
3. account = Account.create<Type>(id, identityRef, [createdBy: callerRef])
4. save(account)
5. saveEvent({ account_id: account.id, type: 'created', performed_by: callerRef })
   ← fire & forget, tolerado
```

Solo disponible internamente — no expuesto como endpoint público.

---

#### `RequestOrganizer`

```
[autorización] callerRef viene del JWT — es el propio usuario

1. findByIdentityRefAndType(callerRef, ORGANIZER)  → si existe → AccountAlreadyExistsError
   (no importa el status — no puede haber dos ORGANIZER para la misma Identity)
2. findByIdentityRefAndType(callerRef, USER)
   → si no existe → AccountNotFoundError
   → si status !== ACTIVE → InsufficientPermissionsError
   (si está DEACTIVATED, el account existe — decir "not found" sería engañoso)
3. account = Account.createOrganizer(id, callerRef)
4. save(account)
5. saveEvent({ account_id: account.id, type: 'created', performed_by: callerRef })
   ← fire & forget, tolerado
```

---

#### `ApproveOrganizer`

```
[autorización] callerRef debe tener Account(ADMIN, ACTIVE) → si no → InsufficientPermissionsError

1. findById(accountId)                             → si no existe → AccountNotFoundError
2. account.approve()                               → si status !== PENDING → InvalidStatusTransitionError
3. save(account)
4. saveEvent({ account_id: account.id, type: 'approved', performed_by: callerRef })
   ← fire & forget, tolerado
```

---

#### `RejectOrganizer`

```
[autorización] callerRef debe tener Account(ADMIN, ACTIVE) → si no → InsufficientPermissionsError

1. findById(accountId)                             → si no existe → AccountNotFoundError
2. account.reject()                                → si status !== PENDING → InvalidStatusTransitionError
3. save(account)
4. saveEvent({ account_id: account.id, type: 'rejected', performed_by: callerRef })
   ← fire & forget, tolerado
```

---

#### `ReRequestOrganizer`

```
[autorización] callerRef viene del JWT — debe ser el dueño del account
               si account.identityRef !== callerRef → AccountNotFoundError (no revelar existencia)

1. findByIdentityRefAndType(callerRef, ORGANIZER)  → si no existe → AccountNotFoundError
2. account.reRequest()                             → si status !== REJECTED → InvalidStatusTransitionError
3. save(account)
4. saveEvent({ account_id: account.id, type: 're_requested', performed_by: callerRef })
   ← fire & forget, tolerado
```

---

#### `DeactivateAccount`

```
[autorización] callerRef debe tener Account(ADMIN, ACTIVE) → si no → InsufficientPermissionsError

1. findById(accountId)                             → si no existe → AccountNotFoundError
2. account.deactivate()                            → si status !== ACTIVE → InvalidStatusTransitionError
3. save(account)
4. saveEvent({ account_id: account.id, type: 'deactivated', performed_by: callerRef })
   ← fire & forget, tolerado
```

---

#### `ReactivateAccount`

```
[autorización] callerRef debe tener Account(ADMIN, ACTIVE) → si no → InsufficientPermissionsError

1. findById(accountId)                             → si no existe → AccountNotFoundError
2. account.reactivate()                            → si status !== DEACTIVATED → InvalidStatusTransitionError
3. save(account)
4. saveEvent({ account_id: account.id, type: 'reactivated', performed_by: callerRef })
   ← fire & forget, tolerado
```

---

#### `GetAccountsByIdentity`

```
[autorización] callerRef viene del JWT
               si callerRef === identityRef → puede ver sus propios accounts
               si callerRef tiene Account(ADMIN, ACTIVE) → puede ver cualquier identity
               cualquier otro caso → AccountNotFoundError (no revelar existencia)

1. findByIdentityRef(identityRef)                  → Account[]
2. return accounts (todos los statuses — es para perfil y panel admin)
```

---

### Account — Modelo de datos

```sql
CREATE TABLE accounts (
  id              UUID PRIMARY KEY,
  identity_id     UUID NOT NULL REFERENCES identities(id),
  type            TEXT NOT NULL CHECK (type IN ('USER', 'ORGANIZER', 'ADMIN')),
  status          TEXT NOT NULL CHECK (status IN ('ACTIVE', 'PENDING', 'REJECTED', 'DEACTIVATED')),
  created_by      UUID REFERENCES identities(id),   -- solo para ADMIN — quién lo creó
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_identity_account_type UNIQUE (identity_id, type)
);

CREATE INDEX idx_accounts_identity_id        ON accounts(identity_id);
CREATE INDEX idx_accounts_identity_id_status ON accounts(identity_id, status);
-- idx_accounts_identity_id_status cubre findActiveByIdentityRef (query del JWT)
-- es la query más frecuente del sistema — se ejecuta en cada SignIn y RefreshToken

CREATE TABLE account_events (
  id           SERIAL PRIMARY KEY,
  account_id   UUID NOT NULL REFERENCES accounts(id),
  type         TEXT NOT NULL,  -- created, approved, rejected, re_requested, deactivated, reactivated
  performed_by UUID REFERENCES identities(id),  -- quién ejecutó la acción (null = sistema)
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_account_events_account_id ON account_events(account_id);
```

**Notas:**
- La constraint `UNIQUE (identity_id, type)` aplica a todos los statuses — no puede haber dos accounts del mismo tipo para la misma Identity, aunque uno esté REJECTED o DEACTIVATED. Si un ORGANIZER REJECTED quiere re-solicitar, usa `reRequest()` sobre el account existente, no crea uno nuevo.
- `account_events` es auditoría inmutable. El use case escribe el evento después de guardar el cambio de estado. Si el write del evento falla, es tolerado — el estado del account es la fuente de verdad.

---

### Account — Vínculo con RegisterSaga

`CreateAccount(USER, ACTIVE)` es el Step 3 de la saga. Crea el Account de usuario base.

La compensación `DeleteAccount` (hard delete) solo aplica a este account recién creado en el contexto de un registro fallido — ver sección de compensación.

---

---

---

---

### Verification — Parámetros de seguridad

Estos valores viven como constantes en infraestructura — no son invariantes de dominio, son configuración operacional.

| Parámetro | Valor | Notas |
|-----------|-------|-------|
| Formato OTP | 6 dígitos numéricos | Estándar de industria. Compatible con autofill de SMS/email en mobile. |
| TTL | 10 minutos | Suficiente para abrir el email y tipear. Menos que el JWT (15 min) por ser un código de un solo uso. |
| Max intentos | 5 | Ya definido en el schema. Correcto en el quinto intento → éxito (no bloqueo). |
| Cooldown entre requests | 60 segundos | Frena spam sin ser molesto. |
| Límite por hora | 5 OTPs / email / hora | Después del quinto request en la hora → `HourlyLimitExceededError`. |
| Cooldown post-bloqueo | 30 minutos | Después de 5 intentos fallidos, debe esperar antes de pedir uno nuevo. |

---

### Verification — Value Objects

#### `VerificationId`
- SERIAL (entero autoincremental) — ya definido en el schema
- Inmutable

---

#### `OtpCode`
- String de exactamente 6 dígitos numéricos (`/^\d{6}$/`)
- Solo existe en memoria como input del usuario — **nunca se persiste**
- Mismo principio que `RawPassword` en Credential

---

#### `OtpHash`
- String opaco resultado de hashear un `OtpCode` con su salt via HMAC-SHA256
- El dominio lo trata como caja negra — no conoce el algoritmo
- Inmutable una vez creado

---

#### `OtpSalt`
- String de bytes aleatorios usado como clave del HMAC
- Generado al crear la verificación
- Inmutable

---

#### `VerificationStatus`
- Enum: `PENDING | USED | EXPIRED | BLOCKED`
- `PENDING` — OTP generado y enviado, esperando verificación
- `USED` — OTP verificado correctamente. Terminal.
- `EXPIRED` — TTL superado. Terminal. Un nuevo request puede crear una nueva verificación.
- `BLOCKED` — max intentos fallidos agotados. Terminal para el OTP. Requiere cooldown de 30 min antes de nuevo request.

---

### Verification — Entidad

**`EmailVerification`** es el aggregate root del subdominio.

**Factory method `create`:**
- Recibe: `email: Email`, `otpHash: OtpHash`, `otpSalt: OtpSalt`, `maxAttempts: number`, `expiresAt: Date`
- `status` nace como `PENDING`
- `attempts` nace en `0`
- `identityId` nace como `undefined` — se asigna en Sub-step 1a de la saga
- `sentAt` = `now()`

**Operaciones:**

`isExpired(): boolean`
- Retorna `true` si `expiresAt < now()` y `status === PENDING`

`expire(): void`
- Transición: `PENDING → EXPIRED`
- Lanza `InvalidStatusTransitionError` si `status !== PENDING`

`attempt(code: OtpCode, hasher: OtpHasher): AttemptResult`
- Solo disponible si `status === PENDING` y `!isExpired()`
- Incrementa `attempts`
- Si `hasher.verify(code, otpSalt, otpHash)` es verdadero:
  - `status = USED`, `usedAt = now()`
  - Retorna `'used'`
- Si `attempts >= maxAttempts`:
  - `status = BLOCKED`
  - Retorna `'blocked'`
- Retorna `'wrong_code'`

**Nota:** el match se verifica ANTES de chequear el límite de intentos. Si el usuario acierta en su quinto intento, accede. El bloqueo solo ocurre en un quinto intento fallido.

`linkToIdentity(ref: IdentityRef): void`
- Asigna `identityId`
- Solo disponible si `identityId` es `undefined`
- Usado en Sub-step 1a de la saga. Fallo tolerado.

**`AttemptResult`** = `'used' | 'blocked' | 'wrong_code'`

**Invariantes:**
- Solo existe una verificación con `status: PENDING` por email a la vez
- Una vez en `USED`, `EXPIRED` o `BLOCKED` — el status es terminal
- `attempts` nunca supera `maxAttempts` + 1 (el intento que triggerea el bloqueo cuenta)

---

### Verification — Errors

| Error | Cuándo |
|-------|--------|
| `VerificationNotFoundError` | No existe una verificación `PENDING` para el email dado |
| `VerificationExpiredError` | El OTP existía pero su TTL ya pasó |
| `VerificationBlockedError` | Demasiados intentos fallidos — incluye `retryAfter: Date` |
| `VerificationCooldownError` | Request demasiado pronto — incluye `retryAfter: Date` |
| `HourlyLimitExceededError` | Más de 5 requests en la última hora para ese email |
| `InvalidOtpError` | Código incorrecto — incluye `attemptsRemaining: number` |
| `EmailDeliveryError` | El envío del email falló después de reintentos internos |

---

### Verification — Ports

**`EmailVerificationRepository`**
```
save(verification: EmailVerification): Promise<void>
findLatestByEmail(email: Email): Promise<EmailVerification | null>              ← el más reciente, cualquier status
findPendingByEmailForUpdate(email: Email): Promise<EmailVerification | null>   ← SELECT FOR UPDATE — solo para VerifyEmail
findById(id: VerificationId): Promise<EmailVerification | null>                ← para la pre-condición de RegisterSaga
countByEmailInLastHour(email: Email): Promise<number>                          ← cuenta todos los statuses
```

**Nota crítica — `findPendingByEmailForUpdate`:**
Debe ejecutarse con `SELECT FOR UPDATE` dentro de una transacción. Esto previene la race condition en `VerifyEmail`: sin locking, dos requests concurrentes pueden leer `attempts = 0`, ambos fallar el código, y ambos guardar `attempts = 1` — duplicando efectivamente el límite de intentos permitidos.

El sufijo `ForUpdate` en el nombre del método hace explícita la intención de locking para el implementador.

**`EmailEventRepository`** — ya definido en el schema principal
```
save(event: { email: string; type: EmailEventType; verificationId?: number; metadata?: Record<string, unknown> }): Promise<void>
```
`EmailEventType = 'requested' | 'verified' | 'attempt_failed' | 'expired' | 'blocked' | 'hourly_limit_exceeded' | 'cooldown_rejected'`

**`OtpHasher`**
```
hash(code: OtpCode, salt: OtpSalt): OtpHash
verify(code: OtpCode, salt: OtpSalt, hash: OtpHash): boolean
generateSalt(): OtpSalt
```
Implementado con HMAC-SHA256. Más que suficiente para un código de 6 dígitos con TTL de 10 minutos y límite de intentos.

**`OtpGenerator`**
```
generate(): OtpCode   ← 6 dígitos criptográficamente aleatorios (crypto.randomInt)
```

**`EmailSender`**
```
sendOtp(email: Email, code: OtpCode): Promise<void>
```
Incluye reintentos internos (ej: 3 intentos con backoff exponencial). Si falla definitivamente → lanza `EmailDeliveryError`. El use case no persiste nada si el email no se envió.

---

### Verification — Use Cases

| Use Case | Responsabilidad |
|----------|----------------|
| `RequestEmailVerification` | Genera y envía un OTP al email dado. Respeta cooldowns y límite horario. |
| `VerifyEmail` | Valida el OTP ingresado. Retorna `verificationId` + `usedAt` en caso de éxito. |

---

#### `RequestEmailVerification`

```
1. findLatestByEmail(email)   ← cualquier status — PENDING, BLOCKED, USED, EXPIRED

2. Si existe y status relevante:
   a. Si status === BLOCKED:
      - Si now() - sentAt < 30min → VerificationBlockedError (retryAfter: sentAt + 30min)
      - Si no → continuar (puede crear nueva)
   b. Si status === PENDING:
      - Si isExpired() → expire(), save(), saveEvent('expired') — fire & forget, luego continuar sin cooldown
        (el código ya era inválido — no penalizamos al usuario por expiración natural)
      - Si now() - sentAt < 60s → VerificationCooldownError (retryAfter: sentAt + 60s)
      - Si no → expire(), save(), saveEvent('expired') — fire & forget, luego continuar

3. countByEmailInLastHour(email) → si >= 5 → HourlyLimitExceededError
   saveEvent('hourly_limit_exceeded') ← fire & forget

4. code    = generate()
   salt    = generateSalt()
   hash    = hash(code, salt)

5. sendOtp(email, code)
   ← si falla → EmailDeliveryError (nada se persiste)

6. verification = EmailVerification.create(email, hash, salt, maxAttempts: 5, expiresAt: now() + 10min)
7. save(verification)
8. saveEvent({ type: 'requested', verificationId: verification.id }) ← fire & forget

9. return { verificationId: verification.id }
```

**Orden de operaciones:** el email se envía antes de persistir. Si el email falla, no hay registro huérfano. Si la DB falla después de enviar el email (extremadamente raro), el usuario recibe un error y puede reintentar — el código recibido no está en la DB y no puede usarse, pero el daño es mínimo.

---

#### `VerifyEmail`

```
[transacción] todo el use case dentro de una transacción DB

1. findPendingByEmailForUpdate(email) → si no existe → VerificationNotFoundError
   ← SELECT FOR UPDATE — lockea el row para prevenir intentos concurrentes

2. Si verification.isExpired():
   verification.expire()
   save(verification)
   saveEvent('expired') ← fire & forget
   → VerificationExpiredError

3. result = verification.attempt(code, hasher)
4. save(verification)

5. Según result:
   - 'used':
     saveEvent('verified') ← fire & forget
     return { verificationId: verification.id, usedAt: verification.usedAt }

   - 'blocked':
     saveEvent('blocked') ← fire & forget
     → VerificationBlockedError (retryAfter: verification.sentAt + 30min)
     ← consistente con el check de RequestEmailVerification: "now() - sentAt < 30min"

   - 'wrong_code':
     saveEvent('attempt_failed', { attemptsRemaining }) ← fire & forget
     → InvalidOtpError (attemptsRemaining: verification.maxAttempts - verification.attempts)
```

---

### Verification — Modelo de datos

Las tablas `email_verifications` y `email_events` ya están definidas en la sección principal del documento. Se agregan los índices necesarios:

```sql
CREATE UNIQUE INDEX uq_email_verifications_pending_email
  ON email_verifications(email)
  WHERE status = 'PENDING';
-- Garantiza a nivel DB la invariante "solo un PENDING por email a la vez"
-- Es la última línea de defensa ante race conditions — el use case lo chequea antes,
-- la DB lo garantiza si dos requests simultáneos pasan el check de aplicación

CREATE INDEX idx_email_verifications_email_status
  ON email_verifications(email, status);
-- Cubre findPendingByEmail y findLatestByEmail

CREATE INDEX idx_email_verifications_email_sent_at
  ON email_verifications(email, sent_at);
-- Cubre countByEmailInLastHour

CREATE INDEX idx_email_events_email
  ON email_events(email);
```

---

### Verification — Vínculo con RegisterSaga

`RequestEmailVerification` y `VerifyEmail` ocurren **antes** de la saga. Son pasos previos que el cliente ejecuta directamente.

El vínculo con la saga ocurre en dos puntos:

1. **Pre-condición:** el cliente incluye `verificationId` en el body de `POST /register`. La saga hace `findById(verificationId)`, verifica `status === USED` y que `email` coincida con el del registro. De ese registro se extrae `usedAt` (→ `emailVerifiedAt` de `CreateIdentity`). Esto evita ambigüedad histórica y uso cruzado de verificaciones.

2. **Sub-step 1a:** `LinkVerificationToIdentity(verificationId, identityId)` — la saga actualiza `identity_id` en el registro de verificación. Usa `linkToIdentity()` en la entidad. Fire & forget, tolerado.

`Verification` no conoce la saga — es la saga quien la conoce y orquesta.

---

---

---

---

## Update Token — Entrega al cliente

El `updateToken` (refresh token) se entrega en el **response body** — no en una cookie httpOnly.

**Justificación:** Chabit tiene clientes web y mobile. Las cookies httpOnly son XSS-proof pero no funcionan de forma nativa en mobile (React Native, apps nativas). Forzar dos estrategias distintas agrega complejidad sin ganancia proporcional para un sistema en etapa de crecimiento.

El trade-off de seguridad se mitiga por:
- Access token TTL de 15 minutos — ventana de exposición pequeña
- Update token se invalida en cada refresh (rotación)
- Update token se invalida al cambiar contraseña
- Logout explícito disponible (RevokeToken / RevokeAllTokens)

**Recomendación para el cliente web:** guardar el update token en memoria (variable de módulo o contexto de React), no en `localStorage`. Si el usuario cierra la pestaña, debe hacer sign-in nuevamente — trade-off aceptable dado el contexto.

**Forma del response en SignIn, RefreshToken y Register:**
```json
{
  "accessToken": "eyJ...",
  "updateToken": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Estructura de módulos

```
src/modules/
  identity/          ← quién es la persona
  credential/        ← cómo accede al sistema
  account/           ← qué roles tiene
  verification/      ← verificación de email
  registration/      ← RegisterSaga + POST /register
  shared/            ← value objects y errores compartidos
```

**`registration/`** es un módulo propio — la saga es un orquestador cross-cutting que no pertenece a ningún subdominio. Contiene únicamente:
- `RegisterSaga` — el use case orquestador
- El controller de `POST /register`

Importa ports de `identity`, `credential`, `account` y `verification` sin crear dependencias directas entre subdominios.

---

## Endpoints HTTP

### Públicos (sin autenticación)

| Método | Ruta | Use Case | Body / Response |
|--------|------|----------|----------------|
| POST | `/verification/email` | RequestEmailVerification | body: `{ email }` / `{ verificationId }` |
| POST | `/verification/email/verify` | VerifyEmail | body: `{ email, code }` / `{ verificationId }` ← solo verificationId, usedAt lo lee la saga desde DB |
| POST | `/register` | RegisterSaga | body: `{ verificationId, fullName, email, phone, nationality, country, username, password }` / `{ accessToken, updateToken }` |
| POST | `/auth/sign-in` | SignIn | body: `{ username, password }` / `{ accessToken, updateToken }` |
| POST | `/auth/refresh` | RefreshToken | body: `{ updateToken }` / `{ accessToken, updateToken }` |

### Autenticados (JWT)

| Método | Ruta | Use Case | Notas |
|--------|------|----------|-------|
| POST | `/auth/sign-out` | RevokeToken | Logout sesión actual |
| POST | `/auth/sign-out/all` | RevokeAllTokens | Logout global |
| PATCH | `/auth/password` | ChangePassword | body: `{ currentPassword, newPassword }` |
| PATCH | `/auth/username` | ChangeUsername | body: `{ username }` |
| GET | `/profile` | GetProfile | Devuelve identity + accounts propios |
| PATCH | `/profile` | UpdateProfile | body: `{ fullName?, phone?, nationality?, country? }` |
| POST | `/account/organizer/request` | RequestOrganizer | Sin body |
| POST | `/account/organizer/re-request` | ReRequestOrganizer | Sin body |

### Internos (API Key)

Solo accesibles desde `backend-chabit` vía header `X-Api-Key`. El backend es quien verifica que el caller tiene permisos de ADMIN antes de llamar a estos endpoints.

| Método | Ruta | Use Case |
|--------|------|----------|
| GET | `/internal/identity/:id` | GetIdentity |
| GET | `/internal/identity/:id/accounts` | GetAccountsByIdentity |
| POST | `/internal/account/:id/approve` | ApproveOrganizer |
| POST | `/internal/account/:id/reject` | RejectOrganizer |
| PATCH | `/internal/account/:id/deactivate` | DeactivateAccount |
| PATCH | `/internal/account/:id/reactivate` | ReactivateAccount |

**Sobre la autorización en endpoints internos — callerRef:**

Los use cases de Account requieren `callerRef: IdentityRef` para verificar `Account(ADMIN, ACTIVE)`. Los endpoints internos no tienen un JWT de caller — la autenticación es la API key.

**Solución:** los controllers de endpoints internos invocan los use cases con `callerRef = undefined` y pasan un flag `trustedCaller: true`. Los use cases tienen un branch explícito:

```
si trustedCaller === true → skip check de InsufficientPermissionsError
si trustedCaller === false → verificar callerRef tiene Account(ADMIN, ACTIVE)
```

La API key ES la autorización para endpoints internos — el backend ya verificó el permiso de ADMIN del usuario que inició la acción. `chabit-identity` confía en ese contrato.

**Deuda técnica:** este modelo de confianza implícita en la API key es aceptable para un startup con dos servicios. A futuro, migrar a JWT service-to-service (audience = identity, issuer = backend) o mTLS para validación criptográfica del caller.

---

## Manejo de errores

### Formato de respuesta de error

```json
{
  "error": "EMAIL_ALREADY_REGISTERED",
  "message": "El email ya está registrado en el sistema",
  "retryAfter": "2026-02-26T19:00:00Z"
}
```

- `error` — código en SCREAMING_SNAKE_CASE, estable para el cliente
- `message` — texto legible, puede cambiar
- `retryAfter` — solo presente en errores de rate limiting y cooldown (`VerificationBlockedError`, `VerificationCooldownError`, `HourlyLimitExceededError`)

### Error → HTTP status

| Error de dominio | HTTP | Código |
|-----------------|------|--------|
| `IdentityNotFoundError` | 404 | `IDENTITY_NOT_FOUND` |
| `AccountNotFoundError` | 404 | `ACCOUNT_NOT_FOUND` |
| `CredentialNotFoundError` | 404 | `CREDENTIAL_NOT_FOUND` |
| `VerificationNotFoundError` | 404 | `VERIFICATION_NOT_FOUND` |
| `SessionNotFoundError` | 401 | `SESSION_NOT_FOUND` |
| `EmailAlreadyRegisteredError` | 409 | `EMAIL_ALREADY_REGISTERED` |
| `PhoneAlreadyRegisteredError` | 409 | `PHONE_ALREADY_REGISTERED` |
| `UsernameAlreadyTakenError` | 409 | `USERNAME_ALREADY_TAKEN` |
| `UsernameReservedError` | 409 | `USERNAME_RESERVED` |
| `AccountAlreadyExistsError` | 409 | `ACCOUNT_ALREADY_EXISTS` |
| `BlnkRefAlreadyAssignedError` | 409 | `BLNK_REF_ALREADY_ASSIGNED` |
| `InvalidCredentialsError` | 401 | `INVALID_CREDENTIALS` |
| `SessionExpiredError` | 401 | `SESSION_EXPIRED` |
| `InsufficientPermissionsError` | 403 | `INSUFFICIENT_PERMISSIONS` |
| `EmailNotVerifiedError` | 422 | `EMAIL_NOT_VERIFIED` |
| `VerificationExpiredError` | 422 | `VERIFICATION_EXPIRED` |
| `InvalidOtpError` | 422 | `INVALID_OTP` |
| `InvalidStatusTransitionError` | 422 | `INVALID_STATUS_TRANSITION` |
| `CannotChangeUsernameYetError` | 422 | `CANNOT_CHANGE_USERNAME_YET` |
| `VerificationBlockedError` | 429 | `VERIFICATION_BLOCKED` |
| `VerificationCooldownError` | 429 | `VERIFICATION_COOLDOWN` |
| `HourlyLimitExceededError` | 429 | `HOURLY_LIMIT_EXCEEDED` |
| `EmailDeliveryError` | 503 | `EMAIL_DELIVERY_FAILED` |

### Manejo en el backend (cross-servicio)

Cuando `backend-chabit` llama a un endpoint interno de chabit-identity y recibe un error:
- `4xx` — el backend propaga el error al cliente (puede re-mapear el mensaje)
- `5xx` — el backend lo trata como error interno y devuelve 500 al cliente
- `503` — el backend puede reintentar con backoff antes de fallar

---

---

## Flujos pendientes (necesarios antes de lanzar)

### Forgot password / Reset password

No está diseñado aún. Es un flow obligatorio antes del lanzamiento.

Esqueleto del flow:
```
1. POST /auth/forgot-password     body: { email }
   → genera token one-time-use con TTL (ej: 15 min)
   → envía email con link o código
   → misma lógica de rate limiting que Verification

2. POST /auth/reset-password      body: { token, newPassword }
   → valida token (no expirado, no usado)
   → cambia password
   → invalida TODAS las sesiones (incluida la actual si hubiera)
   → marca el token como usado
```

Comparte infraestructura con Verification (OTP, email sender, rate limiting) pero es un flujo propio — un `PasswordReset` no es una `EmailVerification`. Se diseña cuando llegue el momento.

---

## Deuda técnica documentada

Estas decisiones son correctas para el estado actual del sistema. Se revisarán cuando el contexto lo justifique.

### JWT — firma asimétrica (RS256 / EdDSA)

**Estado actual:** JWT firmado con secret compartido (HS256) entre `chabit-identity` y `backend-chabit`.

**Problema:** rotación de secret es operacionalmente costosa; un leak del secret permite firmar tokens falsos.

**Upgrade:** RS256 o EdDSA con JWKS endpoint interno. `chabit-identity` firma con clave privada; `backend-chabit` verifica con clave pública vía JWKS. Rotación sin downtime, sin secreto compartido.

**Cuándo:** cuando haya más de dos servicios consumiendo el JWT, o cuando la seguridad operacional lo justifique.

---

### Refresh token — hash en DB

**Estado actual:** `update_token` se almacena en texto plano en la tabla `sessions`.

**Justificación actual:** UUID v4 tiene 122 bits de entropía — el riesgo de colisión es despreciable. El riesgo real es un dump de DB.

**Upgrade:** guardar `sha256(token + pepper)` en lugar del token en texto plano. El pepper es una constante de configuración (env var). El cliente sigue recibiendo el token en texto plano. Para verificar: `sha256(inputToken + pepper) === stored_hash`.

```
sessions.update_token_hash TEXT UNIQUE  ← reemplaza a update_token
```

**Cuándo:** antes de manejar datos de usuarios reales en producción.

---

### Auth inter-servicio — API key → S2S JWT / mTLS

**Estado actual:** endpoints internos protegidos solo por `X-Api-Key`. Si la key se filtra, cualquier caller desde la red interna puede ejecutar operaciones de admin.

**Upgrade mínimo:** JWT service-to-service (audience = `chabit-identity`, issuer = `backend-chabit`). Cada servicio firma sus requests — no hay secret compartido estático.

**Upgrade óptimo:** mTLS — cada servicio tiene certificado propio, la autenticación es a nivel de transporte.

**Cuándo:** cuando el sistema tenga más de dos servicios o cuando el threat model lo justifique.

---

## Estado del documento

- [x] Visión general
- [x] Subdominios identificados
- [x] Shared kernel
- [x] JWT
- [x] Modelo de datos
- [x] Migración
- [x] Flujo de registro completo (saga)
- [x] Identity — VOs, entidad, errors, ports, use cases
- [x] Identity — compensación de saga (hard delete)
- [x] Identity — vínculo con Verification (sub-step 1a)
- [x] Identity — GetIdentity vs GetProfile
- [x] Identity — unicidad en UpdateProfile
- [ ] Identity — eventos de dominio (pendiente, emerge del resto)
- [x] Credential — VOs, entidad, errors, ports, use cases
- [x] Account — VOs, entidad, policies, errors, ports, use cases
- [x] Account — autorización por use case
- [x] Account — auditoría (account_events)
- [x] Account — bootstrap de ADMIN (seed script)
- [x] Account — índices DB
- [x] Verification — VOs, entidad, errors, ports, use cases
- [x] Verification — parámetros de seguridad documentados
- [x] Verification — índices DB
- [ ] Flujo de login completo (secuencia)   ← SignIn + RefreshToken (use cases definidos, secuencia HTTP pendiente)
- [ ] Flujo de requestOrganizer (secuencia) (use cases definidos, secuencia HTTP pendiente)
- [x] Definición de endpoints HTTP
- [x] Manejo de errores cross-servicio
- [x] Update token — entrega al cliente (response body)
- [x] Estructura de módulos (registration como módulo propio)
- [x] Tareas pendientes en el backend → `BACKEND_MIGRATION.md`
- [x] FK order en compensaciones de saga documentado
- [x] Race condition VerifyEmail → SELECT FOR UPDATE
- [x] Case mismatch status en email_verifications → corregido a UPPERCASE
- [x] callerRef gap en endpoints internos → trustedCaller flag documentado
- [x] Step 5 edge case documentado (cliente redirige a /auth/sign-in)
- [x] Deuda técnica documentada (JWT asimétrico, refresh hash, S2S JWT)
- [ ] Flujo forgot password / reset password (pendiente antes de lanzar)
- [ ] updated_at trigger en email_verifications (detalle de migración)
