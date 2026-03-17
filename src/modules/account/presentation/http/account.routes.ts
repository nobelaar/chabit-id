import { Hono } from 'hono';
import { RequestOrganizerUseCase } from '../../application/use-cases/RequestOrganizer.usecase.js';
import { ApproveOrganizerUseCase } from '../../application/use-cases/ApproveOrganizer.usecase.js';
import { RejectOrganizerUseCase } from '../../application/use-cases/RejectOrganizer.usecase.js';
import { ReRequestOrganizerUseCase } from '../../application/use-cases/ReRequestOrganizer.usecase.js';
import { GetAccountsByIdentityUseCase } from '../../application/use-cases/GetAccountsByIdentity.usecase.js';
import { RequestStaffUseCase } from '../../application/use-cases/RequestStaff.usecase.js';
import { ReRequestStaffUseCase } from '../../application/use-cases/ReRequestStaff.usecase.js';

// NOTE: These routes require JWT auth middleware (Iteración futura).
// For now, callerRef is extracted from x-identity-id header (placeholder).
export function createAccountRoutes(
  requestOrganizer: RequestOrganizerUseCase,
  approveOrganizer: ApproveOrganizerUseCase,
  rejectOrganizer: RejectOrganizerUseCase,
  reRequestOrganizer: ReRequestOrganizerUseCase,
  getAccountsByIdentity: GetAccountsByIdentityUseCase,
  requestStaff: RequestStaffUseCase,
  reRequestStaff: ReRequestStaffUseCase,
): Hono {
  const router = new Hono();

  const getCallerRef = (c: { req: { header: (h: string) => string | undefined } }) =>
    c.req.header('x-identity-id') ?? '';

  // POST /accounts/organizer-request
  router.post('/organizer-request', async (c) => {
    const callerRef = getCallerRef(c);
    const result = await requestOrganizer.execute({ callerRef });
    return c.json(result, 201);
  });

  // POST /accounts/staff-request
  router.post('/staff-request', async (c) => {
    const callerRef = getCallerRef(c);
    const result = await requestStaff.execute({ callerRef });
    return c.json(result, 201);
  });

  // POST /accounts/:accountId/approve
  router.post('/:accountId/approve', async (c) => {
    const callerRef = getCallerRef(c);
    const accountId = c.req.param('accountId');
    await approveOrganizer.execute({ accountId, callerRef });
    return c.json({ message: 'Approved' }, 200);
  });

  // POST /accounts/:accountId/reject
  router.post('/:accountId/reject', async (c) => {
    const callerRef = getCallerRef(c);
    const accountId = c.req.param('accountId');
    await rejectOrganizer.execute({ accountId, callerRef });
    return c.json({ message: 'Rejected' }, 200);
  });

  // POST /accounts/organizer-re-request
  router.post('/organizer-re-request', async (c) => {
    const callerRef = getCallerRef(c);
    await reRequestOrganizer.execute({ callerRef });
    return c.json({ message: 'Re-requested' }, 200);
  });

  // POST /accounts/staff-re-request
  router.post('/staff-re-request', async (c) => {
    const callerRef = getCallerRef(c);
    await reRequestStaff.execute({ callerRef });
    return c.json({ message: 'Re-requested' }, 200);
  });

  // GET /accounts?identityId=xxx
  router.get('/', async (c) => {
    const callerRef = getCallerRef(c);
    const identityRef = c.req.query('identityId') ?? callerRef;
    const accounts = await getAccountsByIdentity.execute({ identityRef, callerRef });
    return c.json({ accounts }, 200);
  });

  return router;
}
