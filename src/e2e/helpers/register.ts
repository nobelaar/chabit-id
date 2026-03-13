import type { Hono } from 'hono';
import type { StubEmailSender } from '../../modules/verification/infrastructure/adapters/StubEmailSender.js';

function decodeJwtPayload(token: string): Record<string, unknown> {
  const part = token.split('.')[1];
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8')) as Record<string, unknown>;
}

export interface RegisteredUser {
  accessToken: string;
  updateToken: string;
  identityRef: string;
  sessionId: string;
  email: string;
  username: string;
  password: string;
}

export interface RegisterOptions {
  email?: string;
  username?: string;
  password?: string;
}

export async function registerTestUser(
  app: Hono,
  emailSender: StubEmailSender,
  overrides: RegisterOptions = {},
): Promise<RegisteredUser> {
  const email = overrides.email ?? 'testuser@example.com';
  const username = overrides.username ?? 'testuser';
  const password = overrides.password ?? 'password123';

  // 1. Request email verification
  const vRes = await app.request('/verification/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const { verificationId } = (await vRes.json()) as { verificationId: number };

  // 2. Verify email using the OTP captured by StubEmailSender
  const code = emailSender.getLastCode(email);
  if (!code) throw new Error(`No OTP found for ${email}`);

  await app.request('/verification/email/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });

  // 3. Register
  const rRes = await app.request('/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      verificationId,
      fullName: 'Test User',
      email,
      phone: '1234567890',
      nationality: 'Argentine',
      country: 'Argentina',
      username,
      password,
    }),
  });
  const { accessToken, updateToken } = (await rRes.json()) as { accessToken: string; updateToken: string };

  const payload = decodeJwtPayload(accessToken);
  const identityRef = payload['sub'] as string;
  const sessionId = payload['sid'] as string;

  return { accessToken, updateToken, identityRef, sessionId, email, username, password };
}
