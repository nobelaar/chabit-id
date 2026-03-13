import { DomainError } from '../../../../shared/domain/errors/DomainError.js';
export class AccountDomainError extends DomainError {
}
export class AccountNotFoundError extends AccountDomainError {
    constructor() { super('Account not found'); }
}
export class AccountAlreadyExistsError extends AccountDomainError {
    constructor(type) { super(`Account of type ${type} already exists for this identity`); }
}
export class InvalidStatusTransitionError extends AccountDomainError {
    constructor(type, from, operation) {
        super(`Cannot perform '${operation}' on ${type} account with status ${from}`);
    }
}
export class InsufficientPermissionsError extends AccountDomainError {
    constructor() { super('Insufficient permissions to perform this action'); }
}
