import { createHash } from 'node:crypto';
import { Pool } from 'pg';
import { Identity, IdentityPrimitives } from '../../domain/entities/Identity.entity.js';
import { IdentityId } from '../../domain/value-objects/IdentityId.vo.js';
import { Email } from '../../../../shared/domain/value-objects/Email.vo.js';
import { PhoneNumber } from '../../../../shared/domain/value-objects/PhoneNumber.vo.js';
import { IdentityRepository } from '../../domain/ports/IdentityRepository.port.js';

export class PostgresIdentityRepository implements IdentityRepository {
  constructor(private readonly pool: Pool) {}

  async save(identity: Identity): Promise<void> {
    const p = identity.toPrimitive();
    await this.pool.query(
      `INSERT INTO identities (id, full_name, email, phone, nationality, country, blnk_identity_id, email_verified_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         phone = EXCLUDED.phone,
         nationality = EXCLUDED.nationality,
         country = EXCLUDED.country,
         blnk_identity_id = EXCLUDED.blnk_identity_id,
         updated_at = EXCLUDED.updated_at`,
      [p.id, p.fullName, p.email, p.phone, p.nationality, p.country, p.blnkIdentityRef ?? null, p.emailVerifiedAt, p.createdAt, p.updatedAt],
    );
  }

  async findById(id: IdentityId): Promise<Identity | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM identities WHERE id = $1`,
      [id.toPrimitive()],
    );
    if (rows.length === 0) return null;
    return this.toEntity(rows[0]);
  }

  async findByEmail(email: Email): Promise<Identity | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM identities WHERE email = $1`,
      [email.toPrimitive()],
    );
    if (rows.length === 0) return null;
    return this.toEntity(rows[0]);
  }

  async findByPhone(phone: PhoneNumber): Promise<Identity | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM identities WHERE phone = $1`,
      [phone.toPrimitive()],
    );
    if (rows.length === 0) return null;
    return this.toEntity(rows[0]);
  }

  async hardDelete(id: IdentityId): Promise<void> {
    await this.pool.query(`DELETE FROM identities WHERE id = $1`, [id.toPrimitive()]);
  }

  async anonymize(id: IdentityId): Promise<void> {
    const raw = id.toPrimitive();
    const suffix = createHash('sha256').update(raw).digest('hex').slice(0, 12);
    await this.pool.query(
      `UPDATE identities
       SET full_name = 'usuario_eliminado',
           email     = $2,
           phone     = $3,
           updated_at = now()
       WHERE id = $1`,
      [raw, `deleted_${suffix}@deleted.chabit.com`, `deleted_${suffix}`],
    );
  }

  private toEntity(row: Record<string, unknown>): Identity {
    return Identity.fromPrimitive({
      id: row['id'] as string,
      fullName: row['full_name'] as string,
      email: row['email'] as string,
      phone: row['phone'] as string,
      nationality: row['nationality'] as string,
      country: row['country'] as string,
      blnkIdentityRef: (row['blnk_identity_id'] as string | null) ?? undefined,
      emailVerifiedAt: row['email_verified_at'] as Date,
      createdAt: row['created_at'] as Date,
      updatedAt: row['updated_at'] as Date,
    } satisfies IdentityPrimitives);
  }
}
