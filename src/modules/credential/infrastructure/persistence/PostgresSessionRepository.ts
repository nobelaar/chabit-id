import { Pool } from 'pg';
import { Session, SessionPrimitives } from '../../domain/entities/Session.entity.js';
import { SessionId } from '../../domain/value-objects/SessionId.vo.js';
import { UpdateToken } from '../../domain/value-objects/UpdateToken.vo.js';
import { CredentialId } from '../../domain/value-objects/CredentialId.vo.js';
import { SessionRepository } from '../../domain/ports/SessionRepository.port.js';

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly pool: Pool) {}

  async save(session: Session): Promise<void> {
    const p = session.toPrimitive();
    await this.pool.query(
      `INSERT INTO sessions (id, credential_id, update_token, expires_at, user_agent, ip_address, created_at, last_used_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         update_token = EXCLUDED.update_token,
         expires_at = EXCLUDED.expires_at,
         last_used_at = EXCLUDED.last_used_at`,
      [p.id, p.credentialId, p.updateToken, p.expiresAt, p.userAgent ?? null, p.ipAddress ?? null, p.createdAt, p.lastUsedAt],
    );
  }

  async findByUpdateToken(token: UpdateToken): Promise<Session | null> {
    const { rows } = await this.pool.query(`SELECT * FROM sessions WHERE update_token = $1`, [token.toPrimitive()]);
    return rows.length ? this.toEntity(rows[0]) : null;
  }

  async findAllByCredentialId(credentialId: CredentialId): Promise<Session[]> {
    const { rows } = await this.pool.query(`SELECT * FROM sessions WHERE credential_id = $1`, [credentialId.toPrimitive()]);
    return rows.map(r => this.toEntity(r));
  }

  async deleteById(id: SessionId): Promise<void> {
    await this.pool.query(`DELETE FROM sessions WHERE id = $1`, [id.toPrimitive()]);
  }

  async deleteAllByCredentialId(credentialId: CredentialId): Promise<void> {
    await this.pool.query(`DELETE FROM sessions WHERE credential_id = $1`, [credentialId.toPrimitive()]);
  }

  async deleteAllByCredentialIdExcept(credentialId: CredentialId, exceptSessionId: SessionId): Promise<void> {
    await this.pool.query(
      `DELETE FROM sessions WHERE credential_id = $1 AND id != $2`,
      [credentialId.toPrimitive(), exceptSessionId.toPrimitive()],
    );
  }

  async deleteExpiredByCredentialId(credentialId: CredentialId): Promise<void> {
    await this.pool.query(
      `DELETE FROM sessions WHERE credential_id = $1 AND expires_at < now()`,
      [credentialId.toPrimitive()],
    );
  }

  async countActiveByCredentialId(credentialId: CredentialId): Promise<number> {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*) FROM sessions WHERE credential_id = $1 AND expires_at > now()`,
      [credentialId.toPrimitive()],
    );
    return parseInt(rows[0]['count'] as string, 10);
  }

  async deleteOldestByCredentialId(credentialId: CredentialId): Promise<void> {
    await this.pool.query(
      `DELETE FROM sessions WHERE id = (
         SELECT id FROM sessions WHERE credential_id = $1 ORDER BY last_used_at ASC LIMIT 1
       )`,
      [credentialId.toPrimitive()],
    );
  }

  private toEntity(row: Record<string, unknown>): Session {
    return Session.fromPrimitive({
      id: row['id'] as string,
      credentialId: row['credential_id'] as string,
      updateToken: row['update_token'] as string,
      expiresAt: row['expires_at'] as Date,
      userAgent: (row['user_agent'] as string | null) ?? undefined,
      ipAddress: (row['ip_address'] as string | null) ?? undefined,
      createdAt: row['created_at'] as Date,
      lastUsedAt: row['last_used_at'] as Date,
    } satisfies SessionPrimitives);
  }
}
