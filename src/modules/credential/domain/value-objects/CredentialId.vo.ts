import { DomainError } from '../../../../shared/domain/errors/DomainError.js';
import { randomUUID } from 'node:crypto';

export class InvalidCredentialIdError extends DomainError {
  constructor(v: string) { super(`Invalid credential ID: "${v}"`); }
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class CredentialId {
  private readonly value: string;
  private constructor(v: string) { this.value = v; }
  static generate(): CredentialId { return new CredentialId(randomUUID()); }
  static fromPrimitive(v: string): CredentialId {
    if (!UUID_V4.test(v)) throw new InvalidCredentialIdError(v);
    return new CredentialId(v);
  }
  toPrimitive(): string { return this.value; }
  equals(other: CredentialId): boolean { return this.value === other.value; }
}
