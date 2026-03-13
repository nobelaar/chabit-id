import { describe, it, expect, beforeEach } from 'vitest';
import type { Hono } from 'hono';
import { createTestApp } from '../shared/presentation/http/test-app.js';
import { registerTestUser } from './helpers/register.js';
import type { StubEmailSender } from '../modules/verification/infrastructure/adapters/StubEmailSender.js';

const HEADERS = { 'Content-Type': 'application/json' };

describe('Registration E2E', () => {
  let app: Hono;
  let emailSender: StubEmailSender;

  beforeEach(() => {
    ({ app, emailSender } = createTestApp());
  });

  it('completes the full registration flow and returns tokens', async () => {
    const user = await registerTestUser(app, emailSender);
    expect(typeof user.accessToken).toBe('string');
    expect(typeof user.updateToken).toBe('string');
    expect(user.accessToken.split('.').length).toBe(3); // valid JWT structure
  });

  it('returns error with invalid verificationId', async () => {
    const res = await app.request('/register', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        verificationId: 9999,
        fullName: 'Test User',
        email: 'ghost@example.com',
        phone: '1234567890',
        nationality: 'Argentine',
        country: 'Argentina',
        username: 'ghostuser',
        password: 'password123',
      }),
    });
    // verificationId doesn't exist → not found or not verified
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('returns 400 for missing required field', async () => {
    const res = await app.request('/register', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        // missing verificationId and other required fields
        email: 'incomplete@example.com',
        username: 'incomplete',
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('VALIDATION_ERROR');
  });
});
