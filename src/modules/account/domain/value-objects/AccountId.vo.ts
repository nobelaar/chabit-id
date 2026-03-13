import { DomainError } from '../../../../shared/domain/errors/DomainError.js';
import { randomUUID } from 'node:crypto';

export class InvalidAccountIdError extends DomainError {
  constructor(v: string) { super(`Invalid account ID: "${v}"`); }
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AccountId {
  private readonly value: string;
  private constructor(v: string) { this.value = v; }
  static generate(): AccountId { return new AccountId(randomUUID()); }
  static fromPrimitive(v: string): AccountId {
    if (!UUID_V4.test(v)) throw new InvalidAccountIdError(v);
    return new AccountId(v);
  }
  toPrimitive(): string { return this.value; }
  equals(other: AccountId): boolean { return this.value === other.value; }
}
