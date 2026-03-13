import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { rateLimiter } from 'hono-rate-limiter';
import { requestVerificationSchema, verifyEmailSchema } from './verification.schemas.js';
import { RequestEmailVerificationUseCase } from '../../application/use-cases/RequestEmailVerification.usecase.js';
import { VerifyEmailUseCase } from '../../application/use-cases/VerifyEmail.usecase.js';

export function createVerificationRoutes(
  requestUseCase: RequestEmailVerificationUseCase,
  verifyUseCase: VerifyEmailUseCase,
): Hono {
  const router = new Hono();

  const requestLimiter = rateLimiter({
    windowMs: 60 * 1000,
    limit: 3,
    keyGenerator: (c) => c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown',
    message: { error: 'RATE_LIMITED', message: 'Too many requests. Try again later.' },
  });

  const verifyLimiter = rateLimiter({
    windowMs: 60 * 1000,
    limit: 10,
    keyGenerator: (c) => c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown',
    message: { error: 'RATE_LIMITED', message: 'Too many requests. Try again later.' },
  });

  // POST /verification/email — Request OTP
  router.post(
    '/email',
    requestLimiter,
    zValidator('json', requestVerificationSchema, (result, c) => {
      if (!result.success) {
        return c.json(
          { error: 'VALIDATION_ERROR', message: 'Invalid request body', details: result.error.issues },
          400,
        );
      }
    }),
    async (c) => {
      const body = c.req.valid('json');
      const result = await requestUseCase.execute({ email: body.email });
      return c.json(result, 201);
    },
  );

  // POST /verification/email/verify — Verify OTP
  router.post(
    '/email/verify',
    verifyLimiter,
    zValidator('json', verifyEmailSchema, (result, c) => {
      if (!result.success) {
        return c.json(
          { error: 'VALIDATION_ERROR', message: 'Invalid request body', details: result.error.issues },
          400,
        );
      }
    }),
    async (c) => {
      const body = c.req.valid('json');
      const result = await verifyUseCase.execute({ email: body.email, code: body.code });
      return c.json(result, 200);
    },
  );

  return router;
}
