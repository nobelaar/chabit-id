import { Hono } from 'hono';
import { GetIdentityUseCase } from '../../application/use-cases/GetIdentity.usecase.js';

export function createIdentityRoutes(getIdentity: GetIdentityUseCase): Hono {
  const router = new Hono();

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
