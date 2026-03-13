export type EmailEventType =
  | 'requested'
  | 'verified'
  | 'attempt_failed'
  | 'expired'
  | 'blocked'
  | 'hourly_limit_exceeded'
  | 'cooldown_rejected';

export interface EmailEventPrimitive {
  email: string;
  type: EmailEventType;
  metadata?: Record<string, unknown>;
  verificationId?: number;
}

export interface EmailEventRepository {
  save(event: EmailEventPrimitive): Promise<void>;
}
