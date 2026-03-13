import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { requestVerificationSchema, verifyEmailSchema } from './verification.schemas.js';
import { RequestEmailVerificationUseCase } from '../../application/use-cases/RequestEmailVerification.usecase.js';
import { VerifyEmailUseCase } from '../../application/use-cases/VerifyEmail.usecase.js';

export function createVerificationRoutes(
  requestUseCase: RequestEmailVerificationUseCase,
  verifyUseCase: VerifyEmailUseCase,
): Hono {
  const router = new Hono();

  // POST /verification/email — Request OTP
  router.post(
    '/email',
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
