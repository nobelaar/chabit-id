import { Session } from '../../domain/entities/Session.entity.js';
export class PostgresSessionRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async save(session) {
        const p = session.toPrimitive();
        await this.pool.query(`INSERT INTO sessions (id, credential_id, update_token, expires_at, user_agent, ip_address, created_at, last_used_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         update_token = EXCLUDED.update_token,
         expires_at = EXCLUDED.expires_at,
         last_used_at = EXCLUDED.last_used_at`, [p.id, p.credentialId, p.updateToken, p.expiresAt, p.userAgent ?? null, p.ipAddress ?? null, p.createdAt, p.lastUsedAt]);
    }
    async findByUpdateToken(token) {
        const { rows } = await this.pool.query(`SELECT * FROM sessions WHERE update_token = $1`, [token.toPrimitive()]);
        return rows.length ? this.toEntity(rows[0]) : null;
    }
    async findAllByCredentialId(credentialId) {
        const { rows } = await this.pool.query(`SELECT * FROM sessions WHERE credential_id = $1`, [credentialId.toPrimitive()]);
        return rows.map(r => this.toEntity(r));
    }
    async deleteById(id) {
        await this.pool.query(`DELETE FROM sessions WHERE id = $1`, [id.toPrimitive()]);
    }
    async deleteAllByCredentialId(credentialId) {
        await this.pool.query(`DELETE FROM sessions WHERE credential_id = $1`, [credentialId.toPrimitive()]);
    }
    async deleteAllByCredentialIdExcept(credentialId, exceptSessionId) {
        await this.pool.query(`DELETE FROM sessions WHERE credential_id = $1 AND id != $2`, [credentialId.toPrimitive(), exceptSessionId.toPrimitive()]);
    }
    async deleteExpiredByCredentialId(credentialId) {
        await this.pool.query(`DELETE FROM sessions WHERE credential_id = $1 AND expires_at < now()`, [credentialId.toPrimitive()]);
    }
    async countActiveByCredentialId(credentialId) {
        const { rows } = await this.pool.query(`SELECT COUNT(*) FROM sessions WHERE credential_id = $1 AND expires_at > now()`, [credentialId.toPrimitive()]);
        return parseInt(rows[0]['count'], 10);
    }
    async deleteOldestByCredentialId(credentialId) {
        await this.pool.query(`DELETE FROM sessions WHERE id = (
         SELECT id FROM sessions WHERE credential_id = $1 ORDER BY last_used_at ASC LIMIT 1
       )`, [credentialId.toPrimitive()]);
    }
    toEntity(row) {
        return Session.fromPrimitive({
            id: row['id'],
            credentialId: row['credential_id'],
            updateToken: row['update_token'],
            expiresAt: row['expires_at'],
            userAgent: row['user_agent'] ?? undefined,
            ipAddress: row['ip_address'] ?? undefined,
            createdAt: row['created_at'],
            lastUsedAt: row['last_used_at'],
        });
    }
}
