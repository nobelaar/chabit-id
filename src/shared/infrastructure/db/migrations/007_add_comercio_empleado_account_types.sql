ALTER TABLE accounts
  DROP CONSTRAINT IF EXISTS accounts_type_check,
  ADD CONSTRAINT accounts_type_check
    CHECK (type IN ('USER', 'ORGANIZER', 'ADMIN', 'STAFF', 'COMERCIO', 'EMPLEADO'));
