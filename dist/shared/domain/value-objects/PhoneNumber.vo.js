import { DomainError } from '../errors/DomainError.js';
export class InvalidPhoneNumberError extends DomainError {
    constructor(value) {
        super(`Invalid phone number: "${value}". Must be 7-15 digits, optionally prefixed with +`);
    }
}
// E.164 compatible: optional leading +, then 7-15 digits
const PHONE_REGEX = /^\+?\d{7,15}$/;
export class PhoneNumber {
    value;
    constructor(value) {
        this.value = value;
    }
    static fromPrimitive(raw) {
        const normalized = raw.trim();
        if (!PHONE_REGEX.test(normalized)) {
            throw new InvalidPhoneNumberError(raw);
        }
        return new PhoneNumber(normalized);
    }
    toPrimitive() {
        return this.value;
    }
    equals(other) {
        return this.value === other.value;
    }
}
