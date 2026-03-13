import { DomainError } from '../../../../shared/domain/errors/DomainError.js';

export abstract class VerificationDomainError extends DomainError {}

export class VerificationNotFoundError extends VerificationDomainError {
  constructor(email: string) {
    super(`No pending verification found for email: ${email}`);
  }
}

export class VerificationExpiredError extends VerificationDomainError {
  constructor() {
    super('Verification code has expired. Please request a new one.');
  }
}

export class VerificationBlockedError extends VerificationDomainError {
  constructor(public readonly retryAfter: Date) {
    super(`Verification is blocked due to too many failed attempts. Retry after ${retryAfter.toISOString()}.`);
  }
}

export class VerificationCooldownError extends VerificationDomainError {
  constructor(public readonly retryAfter: Date) {
    super(`Please wait before requesting another OTP. Retry after ${retryAfter.toISOString()}.`);
  }
}

export class HourlyLimitExceededError extends VerificationDomainError {
  constructor() {
    super('Hourly verification request limit exceeded. Please try again later.');
  }
}

export class InvalidOtpError extends VerificationDomainError {
  constructor(public readonly attemptsRemaining: number) {
    super(`Invalid OTP code. ${attemptsRemaining} attempt(s) remaining.`);
  }
}

export class EmailDeliveryError extends VerificationDomainError {
  constructor(email: string) {
    super(`Failed to deliver OTP email to: ${email}`);
  }
}

export class InvalidStatusTransitionError extends VerificationDomainError {
  constructor(from: string, to: string) {
    super(`Invalid status transition from ${from} to ${to}`);
  }
}

export class DuplicatePendingVerificationError extends VerificationDomainError {
  constructor() {
    super('A pending verification already exists for this email.');
  }
}
