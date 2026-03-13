import { Credential } from '../../domain/entities/Credential.entity.js';
export class PostgresCredentialRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async save(credential) {
        const p = credential.toPrimitive();
        await this.pool.query(`INSERT INTO credentials (id, identity_id, username, password_hash, username_changed_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         username = EXCLUDED.username,
         password_hash = EXCLUDED.password_hash,
         username_changed_at = EXCLUDED.username_changed_at,
         updated_at = EXCLUDED.updated_at`, [p.id, p.identityRef, p.username, p.passwordHash, p.usernameChangedAt ?? null, p.createdAt, p.updatedAt]);
    }
    async findById(id) {
        const { rows } = await this.pool.query(`SELECT * FROM credentials WHERE id = $1`, [id.toPrimitive()]);
        return rows.length ? this.toEntity(rows[0]) : null;
    }
    async findByUsername(username) {
        const { rows } = await this.pool.query(`SELECT * FROM credentials WHERE username = $1`, [username.toPrimitive()]);
        return rows.length ? this.toEntity(rows[0]) : null;
    }
    async findByIdentityRef(ref) {
        const { rows } = await this.pool.query(`SELECT * FROM credentials WHERE identity_id = $1`, [ref.toPrimitive()]);
        return rows.length ? this.toEntity(rows[0]) : null;
    }
    async hardDelete(id) {
        await this.pool.query(`DELETE FROM credentials WHERE id = $1`, [id.toPrimitive()]);
    }
    toEntity(row) {
        return Credential.fromPrimitive({
            id: row['id'],
            identityRef: row['identity_id'],
            username: row['username'],
            passwordHash: row['password_hash'],
            usernameChangedAt: row['username_changed_at'],
            createdAt: row['created_at'],
            updatedAt: row['updated_at'],
        });
    }
}
