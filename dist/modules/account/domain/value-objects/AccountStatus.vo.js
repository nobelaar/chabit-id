import { DomainError } from '../../../../shared/domain/errors/DomainError.js';
export class InvalidAccountStatusError extends DomainError {
    constructor(v) { super(`Invalid account status: "${v}"`); }
}
export class AccountStatus {
    value;
    constructor(v) { this.value = v; }
    static active() { return new AccountStatus('ACTIVE'); }
    static pending() { return new AccountStatus('PENDING'); }
    static rejected() { return new AccountStatus('REJECTED'); }
    static deactivated() { return new AccountStatus('DEACTIVATED'); }
    static fromPrimitive(v) {
        if (!['ACTIVE', 'PENDING', 'REJECTED', 'DEACTIVATED'].includes(v))
            throw new InvalidAccountStatusError(v);
        return new AccountStatus(v);
    }
    toPrimitive() { return this.value; }
    isActive() { return this.value === 'ACTIVE'; }
    isPending() { return this.value === 'PENDING'; }
    isRejected() { return this.value === 'REJECTED'; }
    isDeactivated() { return this.value === 'DEACTIVATED'; }
    equals(other) { return this.value === other.value; }
}
