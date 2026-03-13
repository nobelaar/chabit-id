import { describe, it, expect } from 'vitest';
import { createTestApp } from '../shared/presentation/http/test-app.js';

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const { app } = createTestApp();
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });
});
