import { Pool } from 'pg';
import { Account, AccountPrimitives } from '../../domain/entities/Account.entity.js';
import { AccountId } from '../../domain/value-objects/AccountId.vo.js';
import { AccountType } from '../../domain/value-objects/AccountType.vo.js';
import { IdentityRef } from '../../../../shared/domain/value-objects/IdentityRef.vo.js';
import { AccountRepository } from '../../domain/ports/AccountRepository.port.js';

export class PostgresAccountRepository implements AccountRepository {
  constructor(private readonly pool: Pool) {}

  async save(account: Account): Promise<void> {
    const p = account.toPrimitive();
    await this.pool.query(
      `INSERT INTO accounts (id, identity_id, type, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at`,
      [p.id, p.identityRef, p.type, p.status, p.createdBy ?? null, p.createdAt, p.updatedAt],
    );
  }

  async findById(id: AccountId): Promise<Account | null> {
    const { rows } = await this.pool.query(`SELECT * FROM accounts WHERE id = $1`, [id.toPrimitive()]);
    return rows.length ? this.toEntity(rows[0]) : null;
  }

  async findByIdentityRef(ref: IdentityRef): Promise<Account[]> {
    const { rows } = await this.pool.query(`SELECT * FROM accounts WHERE identity_id = $1`, [ref.toPrimitive()]);
    return rows.map(r => this.toEntity(r));
  }

  async findByIdentityRefAndType(ref: IdentityRef, type: AccountType): Promise<Account | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM accounts WHERE identity_id = $1 AND type = $2`,
      [ref.toPrimitive(), type.toPrimitive()],
    );
    return rows.length ? this.toEntity(rows[0]) : null;
  }

  async findActiveByIdentityRef(ref: IdentityRef): Promise<Account[]> {
    const { rows } = await this.pool.query(
      `SELECT * FROM accounts WHERE identity_id = $1 AND status = 'ACTIVE'`,
      [ref.toPrimitive()],
    );
    return rows.map(r => this.toEntity(r));
  }

  async hardDelete(id: AccountId): Promise<void> {
    await this.pool.query(`DELETE FROM accounts WHERE id = $1`, [id.toPrimitive()]);
  }

  private toEntity(row: Record<string, unknown>): Account {
    return Account.fromPrimitive({
      id: row['id'] as string,
      identityRef: row['identity_id'] as string,
      type: row['type'] as string,
      status: row['status'] as string,
      createdBy: row['created_by'] as string | undefined,
      createdAt: row['created_at'] as Date,
      updatedAt: row['updated_at'] as Date,
    } satisfies AccountPrimitives);
  }
}
