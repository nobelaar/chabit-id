import { Pool } from 'pg';
import { IdentityQueryPort } from '../../../credential/domain/ports/IdentityQueryPort.port.js';
import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';

export class PostgresIdentityQueryAdapter implements IdentityQueryPort {
  constructor(private readonly pool: Pool) {}

  async findIdentityRefByEmail(email: Email): Promise<IdentityRef | null> {
    const { rows } = await this.pool.query(
      `SELECT id FROM identities WHERE email = $1`,
      [email.toPrimitive()],
    );
    if (rows.length === 0) return null;
    return IdentityRef.fromPrimitive(rows[0]['id'] as string);
  }
}
