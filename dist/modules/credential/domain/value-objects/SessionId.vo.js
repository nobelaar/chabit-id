import { DomainError } from '../../../../shared/domain/errors/DomainError.js';
import { randomUUID } from 'node:crypto';
export class InvalidSessionIdError extends DomainError {
    constructor(v) { super(`Invalid session ID: "${v}"`); }
}
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class SessionId {
    value;
    constructor(v) { this.value = v; }
    static generate() { return new SessionId(randomUUID()); }
    static fromPrimitive(v) {
        if (!UUID_V4.test(v))
            throw new InvalidSessionIdError(v);
        return new SessionId(v);
    }
    toPrimitive() { return this.value; }
    equals(other) { return this.value === other.value; }
}
