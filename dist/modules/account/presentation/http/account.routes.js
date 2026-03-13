import { Hono } from 'hono';
// NOTE: These routes require JWT auth middleware (Iteración futura).
// For now, callerRef is extracted from x-identity-id header (placeholder).
export function createAccountRoutes(requestOrganizer, approveOrganizer, rejectOrganizer, reRequestOrganizer, getAccountsByIdentity) {
    const router = new Hono();
    const getCallerRef = (c) => c.req.header('x-identity-id') ?? '';
    // POST /accounts/organizer-request
    router.post('/organizer-request', async (c) => {
        const callerRef = getCallerRef(c);
        const result = await requestOrganizer.execute({ callerRef });
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
    // GET /accounts?identityId=xxx
    router.get('/', async (c) => {
        const callerRef = getCallerRef(c);
        const identityRef = c.req.query('identityId') ?? callerRef;
        const accounts = await getAccountsByIdentity.execute({ identityRef, callerRef });
        return c.json({ accounts }, 200);
    });
    return router;
}
