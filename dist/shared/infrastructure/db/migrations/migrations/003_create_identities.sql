CREATE TABLE identities (
  id              UUID PRIMARY KEY,
  full_name       TEXT NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  phone           TEXT UNIQUE NOT NULL,
  nationality     TEXT NOT NULL,
  country         TEXT NOT NULL,
  blnk_identity_id TEXT UNIQUE,
  email_verified_at TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
