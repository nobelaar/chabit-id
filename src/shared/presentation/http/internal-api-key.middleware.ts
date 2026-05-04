import { timingSafeEqual } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { logger } from '../../infrastructure/logger.js';

export function createInternalApiKeyMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const validKey = process.env['INTERNAL_API_KEY'];
    if (!validKey) {
      logger.error('CRITICAL: INTERNAL_API_KEY is not set');
      return c.json({ error: 'Service configuration error' }, 500);
    }

    const provided = c.req.header('x-internal-api-key');
    if (
      !provided ||
      Buffer.byteLength(provided) !== Buffer.byteLength(validKey) ||
      !timingSafeEqual(Buffer.from(provided), Buffer.from(validKey))
    ) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    await next();
  };
}
