import { Pool } from 'pg';
import { EmailEventPrimitive, EmailEventRepository } from '../../domain/ports/EmailEventRepository.port.js';

export class PostgresEmailEventRepository implements EmailEventRepository {
  constructor(private readonly pool: Pool) {}

  async save(event: EmailEventPrimitive): Promise<void> {
    await this.pool.query(
      `INSERT INTO email_events (email, type, metadata, verification_id)
       VALUES ($1, $2, $3, $4)`,
      [
        event.email,
        event.type,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.verificationId ?? null,
      ],
    );
  }
}
