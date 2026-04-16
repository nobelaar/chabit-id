import { Hono } from 'hono';
import { GetIdentityUseCase } from '../../application/use-cases/GetIdentity.usecase.js';
import { GetIdentityByEmailUseCase } from '../../application/use-cases/GetIdentityByEmail.usecase.js';
import { createAuthMiddleware } from '../../../../shared/presentation/http/auth.middleware.js';

export function createIdentityRoutes(
  getIdentity: GetIdentityUseCase,
  getIdentityByEmail: GetIdentityByEmailUseCase,
  jwtSecret: string,
): Hono {
  const router = new Hono();
  const auth = createAuthMiddleware(jwtSecret);

  // GET /identities?email=user@example.com  — authenticated, for organizer staff lookup
  router.get('/', auth, async (c) => {
    const email = c.req.query('email');
    if (!email) {
      return c.json({ error: 'VALIDATION_ERROR', message: 'email query param is required' }, 400);
    }
    const result = await getIdentityByEmail.execute({ email });
    return c.json({ identityRef: result.identityRef, fullName: result.fullName }, 200);
  });

  // GET /identities/:identityRef
  // Returns only the fields needed by backend-chabit for lazy wallet creation.
  // Deliberately excludes internal fields: blnkIdentityRef, createdAt, updatedAt.
  router.get('/:identityRef', async (c) => {
    const identityRef = c.req.param('identityRef');
    const result = await getIdentity.execute({ identityId: identityRef });
    return c.json({
      identityRef: result.id,
      fullName: result.fullName,
      email: result.email,
      phone: result.phone,
      nationality: result.nationality,
      country: result.country,
      emailVerifiedAt: result.emailVerifiedAt,
    }, 200);
  });

  return router;
}
