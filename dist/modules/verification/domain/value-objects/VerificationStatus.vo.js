import { DomainError } from '../../../../shared/domain/errors/DomainError.js';
export class InvalidVerificationStatusError extends DomainError {
    constructor(value) {
        super(`Invalid verification status: "${value}"`);
    }
}
const VALID_STATUSES = ['PENDING', 'USED', 'EXPIRED', 'BLOCKED'];
export class VerificationStatus {
    value;
    constructor(value) {
        this.value = value;
    }
    static pending() {
        return new VerificationStatus('PENDING');
    }
    static used() {
        return new VerificationStatus('USED');
    }
    static expired() {
        return new VerificationStatus('EXPIRED');
    }
    static blocked() {
        return new VerificationStatus('BLOCKED');
    }
    static fromPrimitive(value) {
        if (!VALID_STATUSES.includes(value)) {
            throw new InvalidVerificationStatusError(value);
        }
        return new VerificationStatus(value);
    }
    toPrimitive() {
        return this.value;
    }
    isPending() {
        return this.value === 'PENDING';
    }
    isUsed() {
        return this.value === 'USED';
    }
    isExpired() {
        return this.value === 'EXPIRED';
    }
    isBlocked() {
        return this.value === 'BLOCKED';
    }
    isTerminal() {
        return this.value === 'USED' || this.value === 'EXPIRED' || this.value === 'BLOCKED';
    }
    equals(other) {
        return this.value === other.value;
    }
}
