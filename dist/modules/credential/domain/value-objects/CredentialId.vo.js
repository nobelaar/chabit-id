import { DomainError } from '../../../../shared/domain/errors/DomainError.js';
import { randomUUID } from 'node:crypto';
export class InvalidCredentialIdError extends DomainError {
    constructor(v) { super(`Invalid credential ID: "${v}"`); }
}
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class CredentialId {
    value;
    constructor(v) { this.value = v; }
    static generate() { return new CredentialId(randomUUID()); }
    static fromPrimitive(v) {
        if (!UUID_V4.test(v))
            throw new InvalidCredentialIdError(v);
        return new CredentialId(v);
    }
    toPrimitive() { return this.value; }
    equals(other) { return this.value === other.value; }
}
