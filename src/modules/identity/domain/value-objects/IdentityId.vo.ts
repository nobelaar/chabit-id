import { DomainError } from '../../../../shared/domain/errors/DomainError.js';
import { randomUUID } from 'node:crypto';

export class InvalidIdentityIdError extends DomainError {
  constructor(value: string) {
    super(`Invalid identity ID: "${value}". Must be a valid UUID.`);
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class IdentityId {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static generate(): IdentityId {
    return new IdentityId(randomUUID());
  }

  static fromPrimitive(value: string): IdentityId {
    if (!UUID_REGEX.test(value)) throw new InvalidIdentityIdError(value);
    return new IdentityId(value);
  }

  toPrimitive(): string { return this.value; }
  equals(other: IdentityId): boolean { return this.value === other.value; }
}
