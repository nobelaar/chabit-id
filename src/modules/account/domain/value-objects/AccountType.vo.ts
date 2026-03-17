import { DomainError } from '../../../../shared/domain/errors/DomainError.js';

export type AccountTypeValue = 'USER' | 'ORGANIZER' | 'ADMIN' | 'STAFF';

export class InvalidAccountTypeError extends DomainError {
  constructor(v: string) { super(`Invalid account type: "${v}"`); }
}

export class AccountType {
  private readonly value: AccountTypeValue;
  private constructor(v: AccountTypeValue) { this.value = v; }

  static user(): AccountType { return new AccountType('USER'); }
  static organizer(): AccountType { return new AccountType('ORGANIZER'); }
  static admin(): AccountType { return new AccountType('ADMIN'); }
  static staff(): AccountType { return new AccountType('STAFF'); }

  static fromPrimitive(v: string): AccountType {
    if (v !== 'USER' && v !== 'ORGANIZER' && v !== 'ADMIN' && v !== 'STAFF') throw new InvalidAccountTypeError(v);
    return new AccountType(v as AccountTypeValue);
  }

  toPrimitive(): AccountTypeValue { return this.value; }
  isUser(): boolean { return this.value === 'USER'; }
  isOrganizer(): boolean { return this.value === 'ORGANIZER'; }
  isAdmin(): boolean { return this.value === 'ADMIN'; }
  isStaff(): boolean { return this.value === 'STAFF'; }
  equals(other: AccountType): boolean { return this.value === other.value; }
}
