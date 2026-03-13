import { Identity } from '../../domain/entities/Identity.entity.js';
export class PostgresIdentityRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async save(identity) {
        const p = identity.toPrimitive();
        await this.pool.query(`INSERT INTO identities (id, full_name, email, phone, nationality, country, blnk_identity_id, email_verified_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         phone = EXCLUDED.phone,
         nationality = EXCLUDED.nationality,
         country = EXCLUDED.country,
         blnk_identity_id = EXCLUDED.blnk_identity_id,
         updated_at = EXCLUDED.updated_at`, [p.id, p.fullName, p.email, p.phone, p.nationality, p.country, p.blnkIdentityRef ?? null, p.emailVerifiedAt, p.createdAt, p.updatedAt]);
    }
    async findById(id) {
        const { rows } = await this.pool.query(`SELECT * FROM identities WHERE id = $1`, [id.toPrimitive()]);
        if (rows.length === 0)
            return null;
        return this.toEntity(rows[0]);
    }
    async findByEmail(email) {
        const { rows } = await this.pool.query(`SELECT * FROM identities WHERE email = $1`, [email.toPrimitive()]);
        if (rows.length === 0)
            return null;
        return this.toEntity(rows[0]);
    }
    async findByPhone(phone) {
        const { rows } = await this.pool.query(`SELECT * FROM identities WHERE phone = $1`, [phone.toPrimitive()]);
        if (rows.length === 0)
            return null;
        return this.toEntity(rows[0]);
    }
    async hardDelete(id) {
        await this.pool.query(`DELETE FROM identities WHERE id = $1`, [id.toPrimitive()]);
    }
    toEntity(row) {
        return Identity.fromPrimitive({
            id: row['id'],
            fullName: row['full_name'],
            email: row['email'],
            phone: row['phone'],
            nationality: row['nationality'],
            country: row['country'],
            blnkIdentityRef: row['blnk_identity_id'] ?? undefined,
            emailVerifiedAt: row['email_verified_at'],
            createdAt: row['created_at'],
            updatedAt: row['updated_at'],
        });
    }
}
