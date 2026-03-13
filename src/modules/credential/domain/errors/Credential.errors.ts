import { DomainError } from '../../../../shared/domain/errors/DomainError.js';

export abstract class CredentialDomainError extends DomainError {}

export class CredentialNotFoundError extends CredentialDomainError {
  constructor() { super('Credential not found'); }
}
export class InvalidCredentialsError extends CredentialDomainError {
  constructor() { super('Invalid username or password'); }
}
export class SessionNotFoundError extends CredentialDomainError {
  constructor() { super('Session not found or token invalid'); }
}
export class SessionExpiredError extends CredentialDomainError {
  constructor() { super('Session has expired. Please sign in again.'); }
}
export class UsernameAlreadyTakenError extends CredentialDomainError {
  constructor(username: string) { super(`Username already taken: ${username}`); }
}
export class UsernameReservedError extends CredentialDomainError {
  constructor(username: string) { super(`Username is reserved: ${username}`); }
}
export class CannotChangeUsernameYetError extends CredentialDomainError {
  constructor(retryAfter: Date) { super(`Cannot change username until ${retryAfter.toISOString()}`); }
}
