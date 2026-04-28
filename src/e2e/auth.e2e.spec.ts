import { describe, it, expect, beforeEach } from 'vitest';
import type { Hono } from 'hono';
import { createTestApp } from '../shared/presentation/http/test-app.js';
import { registerTestUser } from './helpers/register.js';
import type { StubEmailSender } from '../modules/verification/infrastructure/adapters/StubEmailSender.js';

const HEADERS = { 'Content-Type': 'application/json' };

describe('Auth E2E', () => {
  let app: Hono;
  let emailSender: StubEmailSender;

  beforeEach(() => {
    ({ app, emailSender } = createTestApp());
  });

  describe('POST /auth/sign-in', () => {
    it('returns 200 with tokens for correct credentials', async () => {
      const { email, password } = await registerTestUser(app, emailSender);

      const res = await app.request('/auth/sign-in', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ email, password }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { accessToken: string; updateToken: string };
      expect(typeof body.accessToken).toBe('string');
      expect(typeof body.updateToken).toBe('string');
    });

    it('returns 401 for incorrect credentials', async () => {
      await registerTestUser(app, emailSender);

      const res = await app.request('/auth/sign-in', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ email: 'testuser@example.com', password: 'wrongpassword' }),
      });
      expect(res.status).toBe(401);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /auth/refresh', () => {
    it('returns 200 with new tokens for valid updateToken', async () => {
      const { updateToken } = await registerTestUser(app, emailSender);

      const res = await app.request('/auth/refresh', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ updateToken }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { accessToken: string; updateToken: string };
      expect(typeof body.accessToken).toBe('string');
      expect(typeof body.updateToken).toBe('string');
    });

    it('returns 401 for invalid updateToken', async () => {
      const res = await app.request('/auth/refresh', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ updateToken: 'f47ac10b-0000-4372-a567-0e02b2c3d479' }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /auth/sign-out', () => {
    it('returns 200 for valid x-session-id', async () => {
      const { sessionId } = await registerTestUser(app, emailSender);

      const res = await app.request('/auth/sign-out', {
        method: 'POST',
        headers: { 'x-session-id': sessionId },
      });
      expect(res.status).toBe(200);
    });

    it('returns 400 when x-session-id header is missing', async () => {
      const res = await app.request('/auth/sign-out', { method: 'POST' });
      expect(res.status).toBe(400);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('MISSING_SESSION');
    });
  });
});
