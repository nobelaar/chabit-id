import { DomainError } from '../../../../shared/domain/errors/DomainError.js';
export class InvalidBlnkIdentityRefError extends DomainError {
    constructor() { super('BlnkIdentityRef cannot be empty'); }
}
export class BlnkIdentityRef {
    value;
    constructor(value) { this.value = value; }
    static fromPrimitive(raw) {
        if (!raw || raw.trim().length === 0)
            throw new InvalidBlnkIdentityRefError();
        return new BlnkIdentityRef(raw); // store as-is, don't trim
    }
    toPrimitive() { return this.value; }
    equals(other) { return this.value === other.value; }
}
