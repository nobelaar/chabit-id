import { Hono } from 'hono';
import { RequestOrganizerUseCase } from '../../application/use-cases/RequestOrganizer.usecase.js';
import { ApproveOrganizerUseCase } from '../../application/use-cases/ApproveOrganizer.usecase.js';
import { RejectOrganizerUseCase } from '../../application/use-cases/RejectOrganizer.usecase.js';
import { ReRequestOrganizerUseCase } from '../../application/use-cases/ReRequestOrganizer.usecase.js';
import { GetAccountsByIdentityUseCase } from '../../application/use-cases/GetAccountsByIdentity.usecase.js';
import { AddStaffByOrganizerUseCase } from '../../application/use-cases/AddStaffByOrganizer.usecase.js';
import { RemoveStaffByOrganizerUseCase } from '../../application/use-cases/RemoveStaffByOrganizer.usecase.js';
import { RemoveStaffByIdentityRefUseCase } from '../../application/use-cases/RemoveStaffByIdentityRef.usecase.js';
import { createAuthMiddleware } from '../../../../shared/presentation/http/auth.middleware.js';

export function createAccountRoutes(
  requestOrganizer: RequestOrganizerUseCase,
  approveOrganizer: ApproveOrganizerUseCase,
  rejectOrganizer: RejectOrganizerUseCase,
  reRequestOrganizer: ReRequestOrganizerUseCase,
  getAccountsByIdentity: GetAccountsByIdentityUseCase,
  addStaffByOrganizer: AddStaffByOrganizerUseCase,
  removeStaffByOrganizer: RemoveStaffByOrganizerUseCase,
  removeStaffByIdentityRef: RemoveStaffByIdentityRefUseCase,
  jwtSecret: string,
): Hono {
  const router = new Hono();
  const auth = createAuthMiddleware(jwtSecret);

  // POST /accounts/organizer-request
  router.post('/organizer-request', auth, async (c) => {
    const callerRef = c.get('jwtPayload').sub;
    const result = await requestOrganizer.execute({ callerRef });
    return c.json(result, 201);
  });

  // POST /accounts/staff-add  — el organizador agrega a alguien como staff
  router.post('/staff-add', auth, async (c) => {
    const callerRef = c.get('jwtPayload').sub;
    const body = await c.req.json<{ targetRef: string }>();
    const result = await addStaffByOrganizer.execute({ callerRef, targetRef: body.targetRef });
    return c.json(result, 201);
  });

  // DELETE /accounts/staff/:accountId — el organizador saca a un staff por accountId
  router.delete('/staff/:accountId', auth, async (c) => {
    const callerRef = c.get('jwtPayload').sub;
    const accountId = c.req.param('accountId');
    await removeStaffByOrganizer.execute({ callerRef, accountId });
    return c.json({ message: 'Staff removed' }, 200);
  });

  // DELETE /accounts/staff-by-identity/:targetRef — el organizador saca a un staff por identityRef
  router.delete('/staff-by-identity/:targetRef', auth, async (c) => {
    const callerRef = c.get('jwtPayload').sub;
    const targetRef = c.req.param('targetRef');
    await removeStaffByIdentityRef.execute({ callerRef, targetRef });
    return c.json({ message: 'Staff removed' }, 200);
  });

  // POST /accounts/:accountId/approve
  router.post('/:accountId/approve', auth, async (c) => {
    const callerRef = c.get('jwtPayload').sub;
    const accountId = c.req.param('accountId');
    await approveOrganizer.execute({ accountId, callerRef });
    return c.json({ message: 'Approved' }, 200);
  });

  // POST /accounts/:accountId/reject
  router.post('/:accountId/reject', auth, async (c) => {
    const callerRef = c.get('jwtPayload').sub;
    const accountId = c.req.param('accountId');
    await rejectOrganizer.execute({ accountId, callerRef });
    return c.json({ message: 'Rejected' }, 200);
  });

  // POST /accounts/organizer-re-request
  router.post('/organizer-re-request', auth, async (c) => {
    const callerRef = c.get('jwtPayload').sub;
    await reRequestOrganizer.execute({ callerRef });
    return c.json({ message: 'Re-requested' }, 200);
  });

  // GET /accounts?identityId=xxx
  router.get('/', auth, async (c) => {
    const callerRef = c.get('jwtPayload').sub;
    const identityRef = c.req.query('identityId') ?? callerRef;
    const accounts = await getAccountsByIdentity.execute({ identityRef, callerRef });
    return c.json({ accounts }, 200);
  });

  return router;
}
