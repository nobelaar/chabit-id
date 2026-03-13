import { Context } from 'hono';
import { DomainError } from '../../domain/errors/DomainError.js';
import {
  VerificationBlockedError,
  VerificationCooldownError,
  HourlyLimitExceededError,
  VerificationNotFoundError,
  VerificationExpiredError,
  InvalidOtpError,
  EmailDeliveryError,
} from '../../../modules/verification/domain/errors/Verification.errors.js';

interface ErrorResponse {
  error: string;
  message: string;
  retryAfter?: string;
  attemptsRemaining?: number;
}

export function errorHandler(err: Error, c: Context): Response {
  console.error(`[HTTP Error] ${err.name}: ${err.message}`);

  if (err instanceof VerificationBlockedError) {
    return c.json<ErrorResponse>(
      {
        error: 'VERIFICATION_BLOCKED',
        message: err.message,
        retryAfter: err.retryAfter.toISOString(),
      },
      429,
    );
  }

  if (err instanceof VerificationCooldownError) {
    return c.json<ErrorResponse>(
      {
        error: 'VERIFICATION_COOLDOWN',
        message: err.message,
        retryAfter: err.retryAfter.toISOString(),
      },
      429,
    );
  }

  if (err instanceof HourlyLimitExceededError) {
    return c.json<ErrorResponse>(
      {
        error: 'HOURLY_LIMIT_EXCEEDED',
        message: err.message,
      },
      429,
    );
  }

  if (err instanceof VerificationNotFoundError) {
    return c.json<ErrorResponse>(
      {
        error: 'VERIFICATION_NOT_FOUND',
        message: err.message,
      },
      404,
    );
  }

  if (err instanceof VerificationExpiredError) {
    return c.json<ErrorResponse>(
      {
        error: 'VERIFICATION_EXPIRED',
        message: err.message,
      },
      422,
    );
  }

  if (err instanceof InvalidOtpError) {
    return c.json<ErrorResponse>(
      {
        error: 'INVALID_OTP',
        message: err.message,
        attemptsRemaining: err.attemptsRemaining,
      },
      422,
    );
  }

  if (err instanceof EmailDeliveryError) {
    return c.json<ErrorResponse>(
      {
        error: 'EMAIL_DELIVERY_FAILED',
        message: err.message,
      },
      503,
    );
  }

  if (err instanceof DomainError) {
    return c.json<ErrorResponse>(
      {
        error: 'BAD_REQUEST',
        message: err.message,
      },
      400,
    );
  }

  return c.json<ErrorResponse>(
    {
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
    500,
  );
}
