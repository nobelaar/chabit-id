import { createHmac } from 'node:crypto';
import { logger } from '../logger.js';
import type { WebhookSender } from './WebhookSender.port.js';

const DELAYS_MS = [500, 1000, 2000];

export class HttpWebhookSender implements WebhookSender {
  constructor(private readonly secret: string) {}

  async send(url: string, payload: Record<string, unknown>): Promise<void> {
    const bodyString = JSON.stringify(payload);
    const sig = createHmac('sha256', this.secret).update(bodyString).digest('hex');
    const headers = {
      'Content-Type': 'application/json',
      'X-Chabit-Signature': `sha256=${sig}`,
    };

    let lastError: unknown;
    for (let attempt = 0; attempt <= DELAYS_MS.length; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, DELAYS_MS[attempt - 1]));
      }
      try {
        const res = await fetch(url, { method: 'POST', headers, body: bodyString });
        if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
        return;
      } catch (err) {
        lastError = err;
        logger.warn({ err, attempt: attempt + 1, url }, '[HttpWebhookSender] attempt failed');
      }
    }
    throw lastError;
  }
}
