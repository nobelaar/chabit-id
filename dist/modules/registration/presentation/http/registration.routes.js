import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { registerSchema } from './registration.schemas.js';
export function createRegistrationRoutes(saga) {
    const router = new Hono();
    router.post('/', zValidator('json', registerSchema, (result, c) => {
        if (!result.success) {
            return c.json({ error: 'VALIDATION_ERROR', message: 'Invalid request body', details: result.error.issues }, 400);
        }
    }), async (c) => {
        const body = c.req.valid('json');
        const userAgent = c.req.header('user-agent');
        const ipAddress = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip');
        const result = await saga.execute({ ...body, userAgent, ipAddress });
        return c.json(result, 201);
    });
    return router;
}
