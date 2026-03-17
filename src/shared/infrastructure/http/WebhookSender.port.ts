export interface WebhookSender {
  send(url: string, payload: Record<string, unknown>): Promise<void>;
}
