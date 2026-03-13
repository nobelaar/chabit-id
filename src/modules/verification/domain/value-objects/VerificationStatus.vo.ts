import { DomainError } from '../../../../shared/domain/errors/DomainError.js';

export type VerificationStatusValue = 'PENDING' | 'USED' | 'EXPIRED' | 'BLOCKED';

export class InvalidVerificationStatusError extends DomainError {
  constructor(value: string) {
    super(`Invalid verification status: "${value}"`);
  }
}

const VALID_STATUSES: VerificationStatusValue[] = ['PENDING', 'USED', 'EXPIRED', 'BLOCKED'];

export class VerificationStatus {
  private readonly value: VerificationStatusValue;

  private constructor(value: VerificationStatusValue) {
    this.value = value;
  }

  static pending(): VerificationStatus {
    return new VerificationStatus('PENDING');
  }

  static used(): VerificationStatus {
    return new VerificationStatus('USED');
  }

  static expired(): VerificationStatus {
    return new VerificationStatus('EXPIRED');
  }

  static blocked(): VerificationStatus {
    return new VerificationStatus('BLOCKED');
  }

  static fromPrimitive(value: string): VerificationStatus {
    if (!VALID_STATUSES.includes(value as VerificationStatusValue)) {
      throw new InvalidVerificationStatusError(value);
    }
    return new VerificationStatus(value as VerificationStatusValue);
  }

  toPrimitive(): VerificationStatusValue {
    return this.value;
  }

  isPending(): boolean {
    return this.value === 'PENDING';
  }

  isUsed(): boolean {
    return this.value === 'USED';
  }

  isExpired(): boolean {
    return this.value === 'EXPIRED';
  }

  isBlocked(): boolean {
    return this.value === 'BLOCKED';
  }

  isTerminal(): boolean {
    return this.value === 'USED' || this.value === 'EXPIRED' || this.value === 'BLOCKED';
  }

  equals(other: VerificationStatus): boolean {
    return this.value === other.value;
  }
}
