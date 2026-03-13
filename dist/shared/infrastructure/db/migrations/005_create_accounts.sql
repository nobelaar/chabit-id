CREATE TABLE accounts (
  id              UUID PRIMARY KEY,
  identity_id     UUID NOT NULL REFERENCES identities(id),
  type            TEXT NOT NULL CHECK (type IN ('USER', 'ORGANIZER', 'ADMIN')),
  status          TEXT NOT NULL CHECK (status IN ('ACTIVE', 'PENDING', 'REJECTED', 'DEACTIVATED')),
  created_by      UUID REFERENCES identities(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_identity_account_type UNIQUE (identity_id, type)
);

CREATE INDEX idx_accounts_identity_id        ON accounts(identity_id);
CREATE INDEX idx_accounts_identity_id_status ON accounts(identity_id, status);

CREATE TABLE account_events (
  id           SERIAL PRIMARY KEY,
  account_id   UUID NOT NULL REFERENCES accounts(id),
  type         TEXT NOT NULL,
  performed_by UUID REFERENCES identities(id),
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_account_events_account_id ON account_events(account_id);
