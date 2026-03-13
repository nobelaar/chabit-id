import { DomainError } from '../../../../shared/domain/errors/DomainError.js';
export class InvalidPasswordError extends DomainError {
    constructor(reason) { super(`Invalid password: ${reason}`); }
}
export class RawPassword {
    value;
    constructor(v) { this.value = v; }
    static fromPrimitive(raw) {
        if (raw.trim().length === 0)
            throw new InvalidPasswordError('cannot be blank');
        if (raw.length < 8)
            throw new InvalidPasswordError('min 8 characters');
        if (raw.length > 128)
            throw new InvalidPasswordError('max 128 characters');
        return new RawPassword(raw);
    }
    toPrimitive() { return this.value; }
}
