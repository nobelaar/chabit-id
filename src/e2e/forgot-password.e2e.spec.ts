import { describe, it, expect, beforeEach } from 'vitest';
import type { Hono } from 'hono';
import { createTestApp } from '../shared/presentation/http/test-app.js';
import { registerTestUser } from './helpers/register.js';
import type { StubEmailSender } from '../modules/verification/infrastructure/adapters/StubEmailSender.js';

const HEADERS = { 'Content-Type': 'application/json' };

describe('Forgot-password E2E', () => {
  let app: Hono;
  let emailSender: StubEmailSender;

  beforeEach(() => {
    ({ app, emailSender } = createTestApp());
  });

  it('returns 200 for registered email', async () => {
    const { email } = await registerTestUser(app, emailSender);

    const res = await app.request('/auth/forgot-password', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ email }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { verificationId: number };
    expect(typeof body.verificationId).toBe('number');
  });

  it('returns 200 for unregistered email (email enumeration safe)', async () => {
    const res = await app.request('/auth/forgot-password', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ email: 'nobody@example.com' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { verificationId: number };
    expect(typeof body.verificationId).toBe('number');
  });

  it('completes full forgot-password → reset → sign-in flow', async () => {
    const { email, username } = await registerTestUser(app, emailSender);
    const newPassword = 'newPassword456!';

    // Trigger forgot-password (creates new verification)
    const fpRes = await app.request('/auth/forgot-password', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ email }),
    });
    expect(fpRes.status).toBe(200);
    const { verificationId } = await fpRes.json() as { verificationId: number };

    // Get the new OTP (most recent code for this email)
    const resetCode = emailSender.getLastCode(email);
    expect(resetCode).toBeDefined();

    // Reset password
    const rpRes = await app.request('/auth/reset-password', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ verificationId, code: resetCode, email, newPassword }),
    });
    expect(rpRes.status).toBe(200);

    // Sign in with new password
    const siRes = await app.request('/auth/sign-in', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ username, password: newPassword }),
    });
    expect(siRes.status).toBe(200);
    const tokens = await siRes.json() as { accessToken: string; updateToken: string };
    expect(typeof tokens.accessToken).toBe('string');
  });
});
