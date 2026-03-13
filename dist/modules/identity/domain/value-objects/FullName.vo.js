import { DomainError } from '../../../../shared/domain/errors/DomainError.js';
export class InvalidFullNameError extends DomainError {
    constructor(reason) { super(`Invalid full name: ${reason}`); }
}
const ALLOWED = /^[\p{L}\s\-']+$/u;
export class FullName {
    value;
    constructor(value) { this.value = value; }
    static fromPrimitive(raw) {
        const v = raw.trim();
        if (v.length === 0)
            throw new InvalidFullNameError('cannot be empty');
        if (v.length > 150)
            throw new InvalidFullNameError('max 150 characters');
        if (!ALLOWED.test(v))
            throw new InvalidFullNameError('contains invalid characters');
        return new FullName(v);
    }
    toPrimitive() { return this.value; }
    equals(other) { return this.value === other.value; }
}
