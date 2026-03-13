import { DomainError } from '../../../../shared/domain/errors/DomainError.js';

export type AccountStatusValue = 'ACTIVE' | 'PENDING' | 'REJECTED' | 'DEACTIVATED';

export class InvalidAccountStatusError extends DomainError {
  constructor(v: string) { super(`Invalid account status: "${v}"`); }
}

export class AccountStatus {
  private readonly value: AccountStatusValue;
  private constructor(v: AccountStatusValue) { this.value = v; }

  static active(): AccountStatus { return new AccountStatus('ACTIVE'); }
  static pending(): AccountStatus { return new AccountStatus('PENDING'); }
  static rejected(): AccountStatus { return new AccountStatus('REJECTED'); }
  static deactivated(): AccountStatus { return new AccountStatus('DEACTIVATED'); }

  static fromPrimitive(v: string): AccountStatus {
    if (!['ACTIVE','PENDING','REJECTED','DEACTIVATED'].includes(v)) throw new InvalidAccountStatusError(v);
    return new AccountStatus(v as AccountStatusValue);
  }

  toPrimitive(): AccountStatusValue { return this.value; }
  isActive(): boolean { return this.value === 'ACTIVE'; }
  isPending(): boolean { return this.value === 'PENDING'; }
  isRejected(): boolean { return this.value === 'REJECTED'; }
  isDeactivated(): boolean { return this.value === 'DEACTIVATED'; }
  equals(other: AccountStatus): boolean { return this.value === other.value; }
}
