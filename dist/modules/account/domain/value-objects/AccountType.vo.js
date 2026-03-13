import { DomainError } from '../../../../shared/domain/errors/DomainError.js';
export class InvalidAccountTypeError extends DomainError {
    constructor(v) { super(`Invalid account type: "${v}"`); }
}
export class AccountType {
    value;
    constructor(v) { this.value = v; }
    static user() { return new AccountType('USER'); }
    static organizer() { return new AccountType('ORGANIZER'); }
    static admin() { return new AccountType('ADMIN'); }
    static fromPrimitive(v) {
        if (v !== 'USER' && v !== 'ORGANIZER' && v !== 'ADMIN')
            throw new InvalidAccountTypeError(v);
        return new AccountType(v);
    }
    toPrimitive() { return this.value; }
    isUser() { return this.value === 'USER'; }
    isOrganizer() { return this.value === 'ORGANIZER'; }
    isAdmin() { return this.value === 'ADMIN'; }
    equals(other) { return this.value === other.value; }
}
