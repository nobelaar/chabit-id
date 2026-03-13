import { DomainError } from '../../../../shared/domain/errors/DomainError.js';
export class InvalidPasswordHashError extends DomainError {
    constructor() { super('PasswordHash cannot be empty'); }
}
export class PasswordHash {
    value;
    constructor(v) { this.value = v; }
    static fromPrimitive(v) {
        if (!v)
            throw new InvalidPasswordHashError();
        return new PasswordHash(v);
    }
    toPrimitive() { return this.value; }
}
