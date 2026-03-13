import { describe, it, expect, beforeEach } from 'vitest';
import type { Hono } from 'hono';
import { createTestApp } from '../shared/presentation/http/test-app.js';
import type { StubEmailSender } from '../modules/verification/infrastructure/adapters/StubEmailSender.js';

const EMAIL = 'verify@example.com';
const HEADERS = { 'Content-Type': 'application/json' };

describe('Verification E2E', () => {
  let app: Hono;
  let emailSender: StubEmailSender;

  beforeEach(() => {
    ({ app, emailSender } = createTestApp());
  });

  describe('POST /verification/email', () => {
    it('returns 201 with verificationId for valid email', async () => {
      const res = await app.request('/verification/email', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ email: EMAIL }),
      });
      expect(res.status).toBe(201);
      const body = await res.json() as { verificationId: unknown };
      expect(typeof body.verificationId).toBe('number');
      expect(body.verificationId).toBeGreaterThan(0);
    });

    it('returns 400 for invalid email', async () => {
      const res = await app.request('/verification/email', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ email: 'not-an-email' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /verification/email/verify', () => {
    it('returns 200 with correct code', async () => {
      // Request verification first
      const vRes = await app.request('/verification/email', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ email: EMAIL }),
      });
      const { verificationId } = await vRes.json() as { verificationId: number };

      const code = emailSender.getLastCode(EMAIL);
      expect(code).toBeDefined();

      const res = await app.request('/verification/email/verify', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ email: EMAIL, code }),
      });
      expect(res.status).toBe(200);
      const body = await res.json() as { verificationId: number; usedAt: string };
      expect(body.verificationId).toBe(verificationId);
      expect(body.usedAt).toBeDefined();
    });

    it('returns 422 with wrong code', async () => {
      await app.request('/verification/email', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ email: EMAIL }),
      });

      const res = await app.request('/verification/email/verify', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ email: EMAIL, code: '000000' }),
      });
      expect(res.status).toBe(422);
      const body = await res.json() as { error: string };
      expect(body.error).toBe('INVALID_OTP');
    });
  });
});
