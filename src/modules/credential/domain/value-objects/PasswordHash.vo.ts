import { DomainError } from '../../../../shared/domain/errors/DomainError.js';

export class InvalidPasswordHashError extends DomainError {
  constructor() { super('PasswordHash cannot be empty'); }
}

export class PasswordHash {
  private readonly value: string;
  private constructor(v: string) { this.value = v; }
  static fromPrimitive(v: string): PasswordHash {
    if (!v) throw new InvalidPasswordHashError();
    return new PasswordHash(v);
  }
  toPrimitive(): string { return this.value; }
}
