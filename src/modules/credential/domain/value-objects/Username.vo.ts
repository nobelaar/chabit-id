import { DomainError } from '../../../../shared/domain/errors/DomainError.js';

export class InvalidUsernameError extends DomainError {
  constructor(reason: string) { super(`Invalid username: ${reason}`); }
}

// Regex: 3-30 chars, a-z0-9_-, must start and end with alphanumeric
const USERNAME_REGEX = /^[a-z0-9]([a-z0-9_-]{1,28}[a-z0-9])?$/;

export class Username {
  private readonly value: string;
  private constructor(v: string) { this.value = v; }
  static fromPrimitive(raw: string): Username {
    const v = raw.trim().toLowerCase();
    if (v.length < 3) throw new InvalidUsernameError('min 3 characters');
    if (v.length > 30) throw new InvalidUsernameError('max 30 characters');
    if (!USERNAME_REGEX.test(v)) throw new InvalidUsernameError('only a-z, 0-9, _, - allowed; cannot start/end with _ or -');
    return new Username(v);
  }
  toPrimitive(): string { return this.value; }
  equals(other: Username): boolean { return this.value === other.value; }
}
