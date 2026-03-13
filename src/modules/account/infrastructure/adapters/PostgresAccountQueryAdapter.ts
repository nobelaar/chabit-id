import { Pool } from 'pg';
import { AccountQueryPort, AccountSnapshot } from '../../../credential/domain/ports/AccountQueryPort.port.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';

export class PostgresAccountQueryAdapter implements AccountQueryPort {
  constructor(private readonly pool: Pool) {}

  async getAccountsByIdentityRef(ref: IdentityRef): Promise<AccountSnapshot[]> {
    const { rows } = await this.pool.query(
      `SELECT id, type, status FROM accounts WHERE identity_id = $1 AND status = 'ACTIVE'`,
      [ref.toPrimitive()],
    );
    return rows.map(r => ({
      id: r['id'] as string,
      type: r['type'] as string,
      status: r['status'] as string,
    }));
  }
}
