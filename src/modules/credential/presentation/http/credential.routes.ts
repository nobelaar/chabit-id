import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { rateLimiter, RedisStore } from 'hono-rate-limiter';
import type { RedisClient } from 'hono-rate-limiter';
import {
  signInSchema,
  refreshTokenSchema,
  changePasswordSchema,
  changeUsernameSchema,
  resetPasswordSchema,
  forgotPasswordSchema,
  totpVerifySchema,
  totpCodeSchema,
} from './credential.schemas.js';
import { SignInUseCase } from '../../application/use-cases/SignIn.usecase.js';
import { RefreshTokenUseCase } from '../../application/use-cases/RefreshToken.usecase.js';
import { RevokeTokenUseCase } from '../../application/use-cases/RevokeToken.usecase.js';
import { ChangePasswordUseCase } from '../../application/use-cases/ChangePassword.usecase.js';
import { RevokeAllTokensUseCase } from '../../application/use-cases/RevokeAllTokens.usecase.js';
import { ChangeUsernameUseCase } from '../../application/use-cases/ChangeUsername.usecase.js';
import { ResetPasswordUseCase } from '../../application/use-cases/ResetPassword.usecase.js';
import { RequestEmailVerificationUseCase } from '../../../verification/application/use-cases/RequestEmailVerification.usecase.js';
import { SetupTOTPUseCase } from '../../application/use-cases/SetupTOTP.usecase.js';
import { EnableTOTPUseCase } from '../../application/use-cases/EnableTOTP.usecase.js';
import { VerifyTOTPUseCase } from '../../application/use-cases/VerifyTOTP.usecase.js';
import { DisableTOTPUseCase } from '../../application/use-cases/DisableTOTP.usecase.js';

// NOTE: RevokeToken requires the session ID from the JWT.
// For now, the route extracts 'x-session-id' header (set by the client from the JWT sid claim).
// In a real JWT middleware setup this would be extracted from the verified token.
export function createCredentialRoutes(
  signInUseCase: SignInUseCase,
  refreshTokenUseCase: RefreshTokenUseCase,
  revokeTokenUseCase: RevokeTokenUseCase,
  changePasswordUseCase: ChangePasswordUseCase,
  revokeAllTokensUseCase: RevokeAllTokensUseCase,
  changeUsernameUseCase: ChangeUsernameUseCase,
  resetPasswordUseCase: ResetPasswordUseCase,
  requestVerificationUseCase: RequestEmailVerificationUseCase,
  setupTotpUseCase: SetupTOTPUseCase,
  enableTotpUseCase: EnableTOTPUseCase,
  verifyTotpUseCase: VerifyTOTPUseCase,
  disableTotpUseCase: DisableTOTPUseCase,
  redisClient?: RedisClient | null,
): Hono {
  const router = new Hono();
  const store = redisClient ? new RedisStore({ client: redisClient }) : undefined;

  const forgotPasswordLimiter = rateLimiter({
    windowMs: 60 * 1000,
    limit: 3,
    store,
    keyGenerator: (c) => c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown',
    message: { error: 'RATE_LIMITED', message: 'Too many requests. Try again later.' },
  });

  const resetPasswordLimiter = rateLimiter({
    windowMs: 60 * 1000,
    limit: 10,
    store,
    keyGenerator: (c) => c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown',
    message: { error: 'RATE_LIMITED', message: 'Too many requests. Try again later.' },
  });

  // POST /auth/sign-in
  router.post(
    '/sign-in',
    zValidator('json', signInSchema, (result, c) => {
      if (!result.success) return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid request body', details: result.error.issues }, 400);
    }),
    async (c) => {
      const body = c.req.valid('json');
      const userAgent = c.req.header('user-agent');
      const ipAddress = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip');
      const result = await signInUseCase.execute({ username: body.username, password: body.password, userAgent, ipAddress });
      return c.json(result, 200);
    },
  );

  // POST /auth/refresh
  router.post(
    '/refresh',
    zValidator('json', refreshTokenSchema, (result, c) => {
      if (!result.success) return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid request body', details: result.error.issues }, 400);
    }),
    async (c) => {
      const body = c.req.valid('json');
      const result = await refreshTokenUseCase.execute({ updateToken: body.updateToken });
      return c.json(result, 200);
    },
  );

  // POST /auth/sign-out
  router.post('/sign-out', async (c) => {
    const sessionId = c.req.header('x-session-id');
    if (!sessionId) return c.json({ error: 'MISSING_SESSION', message: 'x-session-id header required' }, 400);
    await revokeTokenUseCase.execute({ sessionId });
    return c.json({ message: 'Signed out successfully' }, 200);
  });

  // PATCH /auth/change-password
  router.patch(
    '/change-password',
    zValidator('json', changePasswordSchema, (result, c) => {
      if (!result.success) return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid request body', details: result.error.issues }, 400);
    }),
    async (c) => {
      const identityRef = c.req.header('x-identity-ref');
      const sessionId = c.req.header('x-session-id');
      if (!identityRef || !sessionId) {
        return c.json({ error: 'MISSING_HEADERS', message: 'x-identity-ref and x-session-id headers are required' }, 400);
      }
      const body = c.req.valid('json');
      await changePasswordUseCase.execute({
        identityRef,
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
        currentSessionId: sessionId,
      });
      return c.json({ message: 'Password changed successfully' }, 200);
    },
  );

  // POST /auth/sign-out/all
  router.post('/sign-out/all', async (c) => {
    const identityRef = c.req.header('x-identity-ref');
    if (!identityRef) {
      return c.json({ error: 'MISSING_HEADERS', message: 'x-identity-ref header is required' }, 400);
    }
    await revokeAllTokensUseCase.execute({ identityRef });
    return c.json({ message: 'All sessions revoked' }, 200);
  });

  // PATCH /auth/change-username
  router.patch(
    '/change-username',
    zValidator('json', changeUsernameSchema, (result, c) => {
      if (!result.success) return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid request body', details: result.error.issues }, 400);
    }),
    async (c) => {
      const identityRef = c.req.header('x-identity-ref');
      if (!identityRef) {
        return c.json({ error: 'MISSING_HEADERS', message: 'x-identity-ref header is required' }, 400);
      }
      const body = c.req.valid('json');
      await changeUsernameUseCase.execute({ identityRef, newUsername: body.newUsername });
      return c.json({ message: 'Username changed successfully' }, 200);
    },
  );

  // POST /auth/reset-password
  router.post(
    '/reset-password',
    resetPasswordLimiter,
    zValidator('json', resetPasswordSchema, (result, c) => {
      if (!result.success) return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid request body', details: result.error.issues }, 400);
    }),
    async (c) => {
      const body = c.req.valid('json');
      await resetPasswordUseCase.execute(body);
      return c.json({ message: 'Password reset successfully' }, 200);
    },
  );

  // POST /auth/forgot-password
  router.post(
    '/forgot-password',
    forgotPasswordLimiter,
    zValidator('json', forgotPasswordSchema, (result, c) => {
      if (!result.success) return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid request body', details: result.error.issues }, 400);
    }),
    async (c) => {
      const body = c.req.valid('json');
      // Always return 200 — don't reveal if email exists
      try {
        const result = await requestVerificationUseCase.execute({ email: body.email });
        return c.json({ verificationId: result.verificationId }, 200);
      } catch {
        // Email doesn't exist or any other error — return fake response
        return c.json({ verificationId: -1 }, 200);
      }
    },
  );

  // POST /auth/2fa/verify  — step 2 of sign-in when 2FA is enabled
  router.post(
    '/2fa/verify',
    zValidator('json', totpVerifySchema, (result, c) => {
      if (!result.success) return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid request body', details: result.error.issues }, 400);
    }),
    async (c) => {
      const body = c.req.valid('json');
      const userAgent = c.req.header('user-agent');
      const ipAddress = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip');
      const result = await verifyTotpUseCase.execute({ challengeToken: body.challengeToken, code: body.code, userAgent, ipAddress });
      return c.json(result, 200);
    },
  );

  // POST /auth/2fa/setup  — generate TOTP secret (authenticated)
  router.post('/2fa/setup', async (c) => {
    const identityRef = c.req.header('x-identity-ref');
    if (!identityRef) return c.json({ error: 'MISSING_HEADERS', message: 'x-identity-ref header is required' }, 400);
    const result = await setupTotpUseCase.execute(identityRef);
    return c.json(result, 200);
  });

  // POST /auth/2fa/enable  — confirm first code and activate 2FA (authenticated)
  router.post(
    '/2fa/enable',
    zValidator('json', totpCodeSchema, (result, c) => {
      if (!result.success) return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid request body', details: result.error.issues }, 400);
    }),
    async (c) => {
      const identityRef = c.req.header('x-identity-ref');
      if (!identityRef) return c.json({ error: 'MISSING_HEADERS', message: 'x-identity-ref header is required' }, 400);
      const body = c.req.valid('json');
      await enableTotpUseCase.execute(identityRef, body.code);
      return c.json({ message: '2FA enabled successfully' }, 200);
    },
  );

  // DELETE /auth/2fa  — disable 2FA (authenticated, requires current code)
  router.delete(
    '/2fa',
    zValidator('json', totpCodeSchema, (result, c) => {
      if (!result.success) return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid request body', details: result.error.issues }, 400);
    }),
    async (c) => {
      const identityRef = c.req.header('x-identity-ref');
      if (!identityRef) return c.json({ error: 'MISSING_HEADERS', message: 'x-identity-ref header is required' }, 400);
      const body = c.req.valid('json');
      await disableTotpUseCase.execute(identityRef, body.code);
      return c.json({ message: '2FA disabled successfully' }, 200);
    },
  );

  return router;
}
