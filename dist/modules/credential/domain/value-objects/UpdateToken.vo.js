import { DomainError } from '../../../../shared/domain/errors/DomainError.js';
import { randomUUID } from 'node:crypto';
export class InvalidUpdateTokenError extends DomainError {
    constructor(v) { super(`Invalid update token: "${v}"`); }
}
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class UpdateToken {
    value;
    constructor(v) { this.value = v; }
    static generate() { return new UpdateToken(randomUUID()); }
    static fromPrimitive(v) {
        if (!UUID_V4.test(v))
            throw new InvalidUpdateTokenError(v);
        return new UpdateToken(v);
    }
    toPrimitive() { return this.value; }
    equals(other) { return this.value === other.value; }
}
