import { DomainError } from '../../../../shared/domain/errors/DomainError.js';
export class InvalidNationalityError extends DomainError {
    constructor(reason) { super(`Invalid nationality: ${reason}`); }
}
const ALLOWED = /^[\p{L}\s\-]+$/u;
export class Nationality {
    value;
    constructor(value) { this.value = value; }
    static fromPrimitive(raw) {
        const v = raw.trim();
        if (v.length === 0)
            throw new InvalidNationalityError('cannot be empty');
        if (v.length > 100)
            throw new InvalidNationalityError('max 100 characters');
        if (!ALLOWED.test(v))
            throw new InvalidNationalityError('contains invalid characters');
        return new Nationality(v);
    }
    toPrimitive() { return this.value; }
    equals(other) { return this.value === other.value; }
}
