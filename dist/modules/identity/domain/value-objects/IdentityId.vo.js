import { DomainError } from '../../../../shared/domain/errors/DomainError.js';
import { randomUUID } from 'node:crypto';
export class InvalidIdentityIdError extends DomainError {
    constructor(value) {
        super(`Invalid identity ID: "${value}". Must be a valid UUID.`);
    }
}
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class IdentityId {
    value;
    constructor(value) {
        this.value = value;
    }
    static generate() {
        return new IdentityId(randomUUID());
    }
    static fromPrimitive(value) {
        if (!UUID_REGEX.test(value))
            throw new InvalidIdentityIdError(value);
        return new IdentityId(value);
    }
    toPrimitive() { return this.value; }
    equals(other) { return this.value === other.value; }
}
