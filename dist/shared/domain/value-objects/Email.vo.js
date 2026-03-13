import { DomainError } from '../errors/DomainError.js';
export class InvalidEmailError extends DomainError {
    constructor(value) {
        super(`Invalid email address: "${value}"`);
    }
}
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_LENGTH = 254;
export class Email {
    value;
    constructor(value) {
        this.value = value;
    }
    static fromPrimitive(raw) {
        const normalized = raw.trim().toLowerCase();
        if (normalized.length === 0 || normalized.length > MAX_LENGTH) {
            throw new InvalidEmailError(raw);
        }
        if (!EMAIL_REGEX.test(normalized)) {
            throw new InvalidEmailError(raw);
        }
        return new Email(normalized);
    }
    toPrimitive() {
        return this.value;
    }
    equals(other) {
        return this.value === other.value;
    }
}
