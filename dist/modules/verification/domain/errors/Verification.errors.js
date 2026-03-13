import { DomainError } from '../../../../shared/domain/errors/DomainError.js';
export class VerificationDomainError extends DomainError {
}
export class VerificationNotFoundError extends VerificationDomainError {
    constructor(email) {
        super(`No pending verification found for email: ${email}`);
    }
}
export class VerificationExpiredError extends VerificationDomainError {
    constructor() {
        super('Verification code has expired. Please request a new one.');
    }
}
export class VerificationBlockedError extends VerificationDomainError {
    retryAfter;
    constructor(retryAfter) {
        super(`Verification is blocked due to too many failed attempts. Retry after ${retryAfter.toISOString()}.`);
        this.retryAfter = retryAfter;
    }
}
export class VerificationCooldownError extends VerificationDomainError {
    retryAfter;
    constructor(retryAfter) {
        super(`Please wait before requesting another OTP. Retry after ${retryAfter.toISOString()}.`);
        this.retryAfter = retryAfter;
    }
}
export class HourlyLimitExceededError extends VerificationDomainError {
    constructor() {
        super('Hourly verification request limit exceeded. Please try again later.');
    }
}
export class InvalidOtpError extends VerificationDomainError {
    attemptsRemaining;
    constructor(attemptsRemaining) {
        super(`Invalid OTP code. ${attemptsRemaining} attempt(s) remaining.`);
        this.attemptsRemaining = attemptsRemaining;
    }
}
export class EmailDeliveryError extends VerificationDomainError {
    constructor(email) {
        super(`Failed to deliver OTP email to: ${email}`);
    }
}
export class InvalidStatusTransitionError extends VerificationDomainError {
    constructor(from, to) {
        super(`Invalid status transition from ${from} to ${to}`);
    }
}
export class DuplicatePendingVerificationError extends VerificationDomainError {
    constructor() {
        super('A pending verification already exists for this email.');
    }
}
