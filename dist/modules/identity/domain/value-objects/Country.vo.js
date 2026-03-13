import { DomainError } from '../../../../shared/domain/errors/DomainError.js';
export class InvalidCountryError extends DomainError {
    constructor(reason) { super(`Invalid country: ${reason}`); }
}
const ALLOWED = /^[\p{L}\s\-]+$/u;
export class Country {
    value;
    constructor(value) { this.value = value; }
    static fromPrimitive(raw) {
        const v = raw.trim();
        if (v.length === 0)
            throw new InvalidCountryError('cannot be empty');
        if (v.length > 100)
            throw new InvalidCountryError('max 100 characters');
        if (!ALLOWED.test(v))
            throw new InvalidCountryError('contains invalid characters');
        return new Country(v);
    }
    toPrimitive() { return this.value; }
    equals(other) { return this.value === other.value; }
}
