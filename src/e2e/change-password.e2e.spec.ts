import { describe, it, expect, beforeEach } from 'vitest';
import type { Hono } from 'hono';
import { createTestApp } from '../shared/presentation/http/test-app.js';
import { registerTestUser } from './helpers/register.js';
import type { StubEmailSender } from '../modules/verification/infrastructure/adapters/StubEmailSender.js';

const HEADERS = { 'Content-Type': 'application/json' };

describe('Change-password E2E', () => {
  let app: Hono;
  let emailSender: StubEmailSender;

  beforeEach(() => {
    ({ app, emailSender } = createTestApp());
  });

  it('returns 200 with correct current password', async () => {
    const { identityRef, sessionId, password } = await registerTestUser(app, emailSender);

    const res = await app.request('/auth/change-password', {
      method: 'PATCH',
      headers: {
        ...HEADERS,
        'x-identity-ref': identityRef,
        'x-session-id': sessionId,
      },
      body: JSON.stringify({ currentPassword: password, newPassword: 'newPassword789!' }),
    });
    expect(res.status).toBe(200);
  });

  it('returns 401 with incorrect current password', async () => {
    const { identityRef, sessionId } = await registerTestUser(app, emailSender);

    const res = await app.request('/auth/change-password', {
      method: 'PATCH',
      headers: {
        ...HEADERS,
        'x-identity-ref': identityRef,
        'x-session-id': sessionId,
      },
      body: JSON.stringify({ currentPassword: 'wrongpassword', newPassword: 'newPassword789!' }),
    });
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('INVALID_CREDENTIALS');
  });

  it('returns 400 when required headers are missing', async () => {
    const res = await app.request('/auth/change-password', {
      method: 'PATCH',
      headers: HEADERS,
      body: JSON.stringify({ currentPassword: 'password123', newPassword: 'newPassword789!' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('MISSING_HEADERS');
  });
});
