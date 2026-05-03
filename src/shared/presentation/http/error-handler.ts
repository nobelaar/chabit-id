import * as Sentry from '@sentry/node';
import { Context } from 'hono';
import { DomainError } from '../../domain/errors/DomainError.js';
import { logger } from '../../infrastructure/logger.js';
import {
  VerificationBlockedError,
  VerificationCooldownError,
  HourlyLimitExceededError,
  VerificationNotFoundError,
  VerificationExpiredError,
  InvalidOtpError,
  EmailDeliveryError,
} from '../../../modules/verification/domain/errors/Verification.errors.js';
import {
  IdentityNotFoundError,
  EmailAlreadyRegisteredError,
  PhoneAlreadyRegisteredError,
  EmailNotVerifiedError,
  BlnkRefAlreadyAssignedError,
} from '../../../modules/identity/domain/errors/Identity.errors.js';
import {
  CredentialNotFoundError,
  InvalidCredentialsError,
  SessionNotFoundError,
  SessionExpiredError,
  UsernameAlreadyTakenError,
  UsernameReservedError,
  CannotChangeUsernameYetError,
  AccountLockedError,
} from '../../../modules/credential/domain/errors/Credential.errors.js';
import {
  AccountNotFoundError,
  AccountAlreadyExistsError,
  InvalidStatusTransitionError as AccountInvalidStatusTransitionError,
  InsufficientPermissionsError,
} from '../../../modules/account/domain/errors/Account.errors.js';
import {
  TotpAlreadyEnabledError,
  TotpNotEnabledError,
  TotpNotSetupError,
  InvalidTotpCodeError,
  InvalidChallengeTokenError,
} from '../../../modules/credential/domain/errors/TOTP.errors.js';

interface ErrorResponse {
  error: string;
  message: string;
  retryAfter?: string;
  attemptsRemaining?: number;
}

export function errorHandler(err: Error, c: Context): Response {

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

  if (err instanceof IdentityNotFoundError) {
    return c.json<ErrorResponse>(
      {
        error: 'IDENTITY_NOT_FOUND',
        message: err.message,
      },
      404,
    );
  }

  if (err instanceof EmailAlreadyRegisteredError) {
    return c.json<ErrorResponse>(
      {
        error: 'EMAIL_ALREADY_REGISTERED',
        message: err.message,
      },
      409,
    );
  }

  if (err instanceof PhoneAlreadyRegisteredError) {
    return c.json<ErrorResponse>(
      {
        error: 'PHONE_ALREADY_REGISTERED',
        message: err.message,
      },
      409,
    );
  }

  if (err instanceof EmailNotVerifiedError) {
    return c.json<ErrorResponse>(
      {
        error: 'EMAIL_NOT_VERIFIED',
        message: err.message,
      },
      422,
    );
  }

  if (err instanceof BlnkRefAlreadyAssignedError) {
    return c.json<ErrorResponse>(
      {
        error: 'BLNK_REF_ALREADY_ASSIGNED',
        message: err.message,
      },
      409,
    );
  }

  if (err instanceof InsufficientPermissionsError) return c.json({ error: 'INSUFFICIENT_PERMISSIONS', message: err.message }, 403);
  if (err instanceof AccountNotFoundError) return c.json({ error: 'ACCOUNT_NOT_FOUND', message: err.message }, 404);
  if (err instanceof AccountAlreadyExistsError) return c.json({ error: 'ACCOUNT_ALREADY_EXISTS', message: err.message }, 409);
  if (err instanceof AccountInvalidStatusTransitionError) return c.json({ error: 'INVALID_STATUS_TRANSITION', message: err.message }, 422);

  if (err instanceof AccountLockedError) {
    return c.json<ErrorResponse>({ error: 'ACCOUNT_LOCKED', message: err.message, retryAfter: err.lockedUntil.toISOString() }, 423);
  }
  if (err instanceof InvalidCredentialsError) return c.json({ error: 'INVALID_CREDENTIALS', message: err.message }, 401);
  if (err instanceof SessionNotFoundError) return c.json({ error: 'SESSION_NOT_FOUND', message: err.message }, 401);
  if (err instanceof SessionExpiredError) return c.json({ error: 'SESSION_EXPIRED', message: err.message }, 401);
  if (err instanceof UsernameAlreadyTakenError) return c.json({ error: 'USERNAME_TAKEN', message: err.message }, 409);
  if (err instanceof UsernameReservedError) return c.json({ error: 'USERNAME_RESERVED', message: err.message }, 409);
  if (err instanceof CannotChangeUsernameYetError) return c.json({ error: 'USERNAME_CHANGE_TOO_SOON', message: err.message }, 422);
  if (err instanceof CredentialNotFoundError) return c.json({ error: 'CREDENTIAL_NOT_FOUND', message: err.message }, 404);

  if (err instanceof InvalidTotpCodeError) return c.json({ error: 'INVALID_TOTP_CODE', message: err.message }, 422);
  if (err instanceof InvalidChallengeTokenError) return c.json({ error: 'INVALID_CHALLENGE_TOKEN', message: err.message }, 401);
  if (err instanceof TotpAlreadyEnabledError) return c.json({ error: 'TOTP_ALREADY_ENABLED', message: err.message }, 409);
  if (err instanceof TotpNotEnabledError) return c.json({ error: 'TOTP_NOT_ENABLED', message: err.message }, 409);
  if (err instanceof TotpNotSetupError) return c.json({ error: 'TOTP_NOT_SETUP', message: err.message }, 422);

  if (err instanceof DomainError) {
    logger.warn({ err: err.name, msg: err.message }, 'domain error');
    return c.json<ErrorResponse>(
      {
        error: 'BAD_REQUEST',
        message: err.message,
      },
      400,
    );
  }

  Sentry.captureException(err);
  logger.error({ err }, 'unhandled error');
  return c.json<ErrorResponse>(
    {
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
    500,
  );
}
