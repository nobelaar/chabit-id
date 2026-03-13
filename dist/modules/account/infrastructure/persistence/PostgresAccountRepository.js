import { Account } from '../../domain/entities/Account.entity.js';
export class PostgresAccountRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async save(account) {
        const p = account.toPrimitive();
        await this.pool.query(`INSERT INTO accounts (id, identity_id, type, status, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at`, [p.id, p.identityRef, p.type, p.status, p.createdBy ?? null, p.createdAt, p.updatedAt]);
    }
    async findById(id) {
        const { rows } = await this.pool.query(`SELECT * FROM accounts WHERE id = $1`, [id.toPrimitive()]);
        return rows.length ? this.toEntity(rows[0]) : null;
    }
    async findByIdentityRef(ref) {
        const { rows } = await this.pool.query(`SELECT * FROM accounts WHERE identity_id = $1`, [ref.toPrimitive()]);
        return rows.map(r => this.toEntity(r));
    }
    async findByIdentityRefAndType(ref, type) {
        const { rows } = await this.pool.query(`SELECT * FROM accounts WHERE identity_id = $1 AND type = $2`, [ref.toPrimitive(), type.toPrimitive()]);
        return rows.length ? this.toEntity(rows[0]) : null;
    }
    async findActiveByIdentityRef(ref) {
        const { rows } = await this.pool.query(`SELECT * FROM accounts WHERE identity_id = $1 AND status = 'ACTIVE'`, [ref.toPrimitive()]);
        return rows.map(r => this.toEntity(r));
    }
    async hardDelete(id) {
        await this.pool.query(`DELETE FROM accounts WHERE id = $1`, [id.toPrimitive()]);
    }
    toEntity(row) {
        return Account.fromPrimitive({
            id: row['id'],
            identityRef: row['identity_id'],
            type: row['type'],
            status: row['status'],
            createdBy: row['created_by'],
            createdAt: row['created_at'],
            updatedAt: row['updated_at'],
        });
    }
}
