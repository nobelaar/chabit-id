import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { signInSchema, refreshTokenSchema } from './credential.schemas.js';
import { SignInUseCase } from '../../application/use-cases/SignIn.usecase.js';
import { RefreshTokenUseCase } from '../../application/use-cases/RefreshToken.usecase.js';
import { RevokeTokenUseCase } from '../../application/use-cases/RevokeToken.usecase.js';

// NOTE: RevokeToken requires the session ID from the JWT.
// For now, the route extracts 'x-session-id' header (set by the client from the JWT sid claim).
// In a real JWT middleware setup this would be extracted from the verified token.
export function createCredentialRoutes(
  signInUseCase: SignInUseCase,
  refreshTokenUseCase: RefreshTokenUseCase,
  revokeTokenUseCase: RevokeTokenUseCase,
): Hono {
  const router = new Hono();

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

  return router;
}
