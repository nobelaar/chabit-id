import { DomainError } from '../../../../shared/domain/errors/DomainError.js';

export class InvalidBlnkIdentityRefError extends DomainError {
  constructor() { super('BlnkIdentityRef cannot be empty'); }
}

export class BlnkIdentityRef {
  private readonly value: string;
  private constructor(value: string) { this.value = value; }

  static fromPrimitive(raw: string): BlnkIdentityRef {
    if (!raw || raw.trim().length === 0) throw new InvalidBlnkIdentityRefError();
    return new BlnkIdentityRef(raw); // store as-is, don't trim
  }

  toPrimitive(): string { return this.value; }
  equals(other: BlnkIdentityRef): boolean { return this.value === other.value; }
}
