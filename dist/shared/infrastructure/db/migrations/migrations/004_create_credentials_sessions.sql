CREATE TABLE credentials (
  id                  UUID PRIMARY KEY,
  identity_id         UUID UNIQUE NOT NULL REFERENCES identities(id),
  username            TEXT UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  username_changed_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id            UUID PRIMARY KEY,
  credential_id UUID NOT NULL REFERENCES credentials(id),
  update_token  TEXT UNIQUE NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  user_agent    TEXT,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_update_token  ON sessions(update_token);
CREATE INDEX idx_sessions_credential_id ON sessions(credential_id);
