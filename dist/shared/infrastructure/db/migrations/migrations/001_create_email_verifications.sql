CREATE TABLE email_verifications (
  id              SERIAL PRIMARY KEY,
  identity_id     UUID,
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

CREATE TABLE email_events (
  id              SERIAL PRIMARY KEY,
  email           TEXT NOT NULL,
  type            TEXT NOT NULL,
  metadata        JSONB,
  verification_id INT REFERENCES email_verifications(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_email_verifications_pending_email
  ON email_verifications(email) WHERE status = 'PENDING';

CREATE INDEX idx_email_verifications_email_status
  ON email_verifications(email, status);

CREATE INDEX idx_email_verifications_email_sent_at
  ON email_verifications(email, sent_at);

CREATE INDEX idx_email_events_email ON email_events(email);
