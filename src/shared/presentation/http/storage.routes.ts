import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { createAuthMiddleware } from './auth.middleware.js';
import { uploadToS3 } from '../../infrastructure/storageService.js';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export function createStorageRoutes(jwtSecret: string): Hono {
  const router = new Hono();
  const auth = createAuthMiddleware(jwtSecret);

  router.post('/upload', auth, async (c) => {
    const body = await c.req.parseBody();
    const file = body['file'];

    if (!file || typeof file === 'string') {
      return c.json({ error: 'No file provided' }, 400);
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return c.json(
        { error: `Unsupported file type: ${file.type}. Allowed: jpeg, png, webp, gif` },
        400,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: 'File too large. Maximum size is 5 MB' }, 400);
    }

    const ext = extname(file.name).toLowerCase() || `.${file.type.split('/')[1]}`;
    const key = `uploads/${randomUUID()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadToS3(key, buffer, file.type);

    return c.json({ url });
  });

  return router;
}
