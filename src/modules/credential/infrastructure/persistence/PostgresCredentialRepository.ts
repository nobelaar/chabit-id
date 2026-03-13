import { Pool } from 'pg';
import { Credential, CredentialPrimitives } from '../../domain/entities/Credential.entity.js';
import { CredentialId } from '../../domain/value-objects/CredentialId.vo.js';
import { Username } from '../../domain/value-objects/Username.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { CredentialRepository } from '../../domain/ports/CredentialRepository.port.js';

export class PostgresCredentialRepository implements CredentialRepository {
  constructor(private readonly pool: Pool) {}

  async save(credential: Credential): Promise<void> {
    const p = credential.toPrimitive();
    await this.pool.query(
      `INSERT INTO credentials (id, identity_id, username, password_hash, username_changed_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         username = EXCLUDED.username,
         password_hash = EXCLUDED.password_hash,
         username_changed_at = EXCLUDED.username_changed_at,
         updated_at = EXCLUDED.updated_at`,
      [p.id, p.identityRef, p.username, p.passwordHash, p.usernameChangedAt ?? null, p.createdAt, p.updatedAt],
    );
  }

  async findById(id: CredentialId): Promise<Credential | null> {
    const { rows } = await this.pool.query(`SELECT * FROM credentials WHERE id = $1`, [id.toPrimitive()]);
    return rows.length ? this.toEntity(rows[0]) : null;
  }

  async findByUsername(username: Username): Promise<Credential | null> {
    const { rows } = await this.pool.query(`SELECT * FROM credentials WHERE username = $1`, [username.toPrimitive()]);
    return rows.length ? this.toEntity(rows[0]) : null;
  }

  async findByIdentityRef(ref: IdentityRef): Promise<Credential | null> {
    const { rows } = await this.pool.query(`SELECT * FROM credentials WHERE identity_id = $1`, [ref.toPrimitive()]);
    return rows.length ? this.toEntity(rows[0]) : null;
  }

  async hardDelete(id: CredentialId): Promise<void> {
    await this.pool.query(`DELETE FROM credentials WHERE id = $1`, [id.toPrimitive()]);
  }

  private toEntity(row: Record<string, unknown>): Credential {
    return Credential.fromPrimitive({
      id: row['id'] as string,
      identityRef: row['identity_id'] as string,
      username: row['username'] as string,
      passwordHash: row['password_hash'] as string,
      usernameChangedAt: row['username_changed_at'] as Date | undefined,
      createdAt: row['created_at'] as Date,
      updatedAt: row['updated_at'] as Date,
    } satisfies CredentialPrimitives);
  }
}
