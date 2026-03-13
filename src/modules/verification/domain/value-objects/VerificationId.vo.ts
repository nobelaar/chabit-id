import { DomainError } from '../../../../shared/domain/errors/DomainError.js';

export class InvalidVerificationIdError extends DomainError {
  constructor(value: number) {
    super(`Invalid verification ID: ${value}. Must be a positive integer.`);
  }
}

export class VerificationId {
  private readonly value: number;

  private constructor(value: number) {
    this.value = value;
  }

  static fromPrimitive(n: number): VerificationId {
    if (!Number.isInteger(n) || n <= 0) {
      throw new InvalidVerificationIdError(n);
    }
    return new VerificationId(n);
  }

  toPrimitive(): number {
    return this.value;
  }

  equals(other: VerificationId): boolean {
    return this.value === other.value;
  }
}
