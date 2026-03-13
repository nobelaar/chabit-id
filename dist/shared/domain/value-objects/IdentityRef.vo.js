import { DomainError } from '../errors/DomainError.js';
export class InvalidIdentityRefError extends DomainError {
    constructor(value) {
        super(`Invalid identity ref: "${value}". Must be a non-empty UUID string.`);
    }
}
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * Cross-subdomain reference to an Identity.
 * Used by Credential and Account to refer to an Identity without importing it directly.
 * Mirrors the organizerRef pattern in chabit-ticketing.
 */
export class IdentityRef {
    value;
    constructor(value) {
        this.value = value;
    }
    static fromPrimitive(raw) {
        if (!UUID_REGEX.test(raw)) {
            throw new InvalidIdentityRefError(raw);
        }
        return new IdentityRef(raw);
    }
    toPrimitive() {
        return this.value;
    }
    equals(other) {
        return this.value === other.value;
    }
}
