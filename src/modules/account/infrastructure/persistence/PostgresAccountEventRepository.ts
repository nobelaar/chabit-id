import { Pool } from 'pg';
import { AccountId } from '../../domain/value-objects/AccountId.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { AccountEventRepository, AccountEventType } from '../../domain/ports/AccountEventRepository.port.js';

export class PostgresAccountEventRepository implements AccountEventRepository {
  constructor(private readonly pool: Pool) {}

  async save(event: {
    accountId: AccountId;
    type: AccountEventType;
    performedBy?: IdentityRef;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO account_events (account_id, type, performed_by, metadata) VALUES ($1, $2, $3, $4)`,
      [
        event.accountId.toPrimitive(),
        event.type,
        event.performedBy?.toPrimitive() ?? null,
        event.metadata ? JSON.stringify(event.metadata) : null,
      ],
    );
  }
}
