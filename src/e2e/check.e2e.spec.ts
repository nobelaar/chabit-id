import { describe, it, expect, beforeEach } from 'vitest';
import type { Hono } from 'hono';
import { createTestApp } from '../shared/presentation/http/test-app.js';
import { registerTestUser } from './helpers/register.js';
import type { StubEmailSender } from '../modules/verification/infrastructure/adapters/StubEmailSender.js';

describe('Check Endpoints E2E', () => {
  let app: Hono;
  let emailSender: StubEmailSender;

  beforeEach(() => {
    ({ app, emailSender } = createTestApp());
  });

  // ── /check/username ───────────────────────────────────────────────

  it('GET /check/username returns available:true for unused username', async () => {
    const res = await app.request('/check/username?value=availableuser');
    expect(res.status).toBe(200);
    const body = await res.json() as { available: boolean };
    expect(body.available).toBe(true);
  });

  it('GET /check/username returns available:false for taken username', async () => {
    await registerTestUser(app, emailSender, { username: 'takenuser' });
    const res = await app.request('/check/username?value=takenuser');
    expect(res.status).toBe(200);
    const body = await res.json() as { available: boolean };
    expect(body.available).toBe(false);
  });

  it('GET /check/username returns 400 for invalid username format', async () => {
    const res = await app.request('/check/username?value=!!invalid');
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('GET /check/username returns 400 when value is missing', async () => {
    const res = await app.request('/check/username');
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  // ── /check/email ──────────────────────────────────────────────────

  it('GET /check/email returns available:true for unused email', async () => {
    const res = await app.request('/check/email?value=free@example.com');
    expect(res.status).toBe(200);
    const body = await res.json() as { available: boolean };
    expect(body.available).toBe(true);
  });

  it('GET /check/email returns available:false for taken email', async () => {
    await registerTestUser(app, emailSender, { email: 'taken@example.com' });
    const res = await app.request('/check/email?value=taken@example.com');
    expect(res.status).toBe(200);
    const body = await res.json() as { available: boolean };
    expect(body.available).toBe(false);
  });

  it('GET /check/email returns 400 for invalid email format', async () => {
    const res = await app.request('/check/email?value=notanemail');
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('GET /check/email returns 400 when value is missing', async () => {
    const res = await app.request('/check/email');
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  // ── /check/phone ──────────────────────────────────────────────────

  it('GET /check/phone returns available:true for unused phone', async () => {
    const res = await app.request('/check/phone?value=9999999999');
    expect(res.status).toBe(200);
    const body = await res.json() as { available: boolean };
    expect(body.available).toBe(true);
  });

  it('GET /check/phone returns available:false for taken phone', async () => {
    // registerTestUser seeds phone = '1234567890'
    await registerTestUser(app, emailSender);
    const res = await app.request('/check/phone?value=1234567890');
    expect(res.status).toBe(200);
    const body = await res.json() as { available: boolean };
    expect(body.available).toBe(false);
  });

  it('GET /check/phone returns 400 for invalid phone format', async () => {
    const res = await app.request('/check/phone?value=abc');
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('GET /check/phone returns 400 when value is missing', async () => {
    const res = await app.request('/check/phone');
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('VALIDATION_ERROR');
  });
});
