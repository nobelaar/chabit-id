import { DomainError } from '../../../../shared/domain/errors/DomainError.js';
export class InvalidVerificationIdError extends DomainError {
    constructor(value) {
        super(`Invalid verification ID: ${value}. Must be a positive integer.`);
    }
}
export class VerificationId {
    value;
    constructor(value) {
        this.value = value;
    }
    static fromPrimitive(n) {
        if (!Number.isInteger(n) || n <= 0) {
            throw new InvalidVerificationIdError(n);
        }
        return new VerificationId(n);
    }
    toPrimitive() {
        return this.value;
    }
    equals(other) {
        return this.value === other.value;
    }
}
