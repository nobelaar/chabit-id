import { EmailVerification } from '../../domain/entities/EmailVerification.entity.js';
import { VerificationId } from '../../domain/value-objects/VerificationId.vo.js';
import { DuplicatePendingVerificationError } from '../../domain/errors/Verification.errors.js';
export class PostgresEmailVerificationRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async save(verification, tx) {
        const runner = tx ? tx : this.pool;
        const p = verification.toPrimitive();
        try {
            if (p.id === undefined) {
                // INSERT — DB assigns the id
                const res = await runner.query(`INSERT INTO email_verifications
             (identity_id, email, otp_hash, otp_salt, status, attempts, max_attempts, expires_at, sent_at, used_at, blocked_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
           RETURNING id`, [
                    p.identityId ?? null,
                    p.email,
                    p.otpHash,
                    p.otpSalt,
                    p.status,
                    p.attempts,
                    p.maxAttempts,
                    p.expiresAt,
                    p.sentAt,
                    p.usedAt ?? null,
                    p.blockedAt ?? null,
                ]);
                verification.assignId(VerificationId.fromPrimitive(res.rows[0].id));
            }
            else {
                // UPDATE
                await runner.query(`UPDATE email_verifications
           SET identity_id = $1,
               status      = $2,
               attempts    = $3,
               used_at     = $4,
               blocked_at  = $5,
               updated_at  = now()
           WHERE id = $6`, [
                    p.identityId ?? null,
                    p.status,
                    p.attempts,
                    p.usedAt ?? null,
                    p.blockedAt ?? null,
                    p.id,
                ]);
            }
        }
        catch (err) {
            if (err.code === '23505') {
                throw new DuplicatePendingVerificationError();
            }
            throw err;
        }
    }
    async findLatestByEmail(email) {
        const res = await this.pool.query(`SELECT * FROM email_verifications
       WHERE email = $1
       ORDER BY sent_at DESC
       LIMIT 1`, [email.toPrimitive()]);
        if (res.rows.length === 0)
            return null;
        return this.rowToEntity(res.rows[0]);
    }
    /**
     * SELECT FOR UPDATE — uses the provided transaction client.
     * The lock is only meaningful inside the active transaction managed by the caller.
     */
    async findPendingByEmailForUpdate(email, tx) {
        const client = tx;
        const res = await client.query(`SELECT * FROM email_verifications
       WHERE email = $1 AND status = 'PENDING'
       ORDER BY sent_at DESC
       LIMIT 1
       FOR UPDATE`, [email.toPrimitive()]);
        if (res.rows.length === 0)
            return null;
        return this.rowToEntity(res.rows[0]);
    }
    async findById(id) {
        const res = await this.pool.query(`SELECT * FROM email_verifications WHERE id = $1`, [id.toPrimitive()]);
        if (res.rows.length === 0)
            return null;
        return this.rowToEntity(res.rows[0]);
    }
    async countByEmailInLastHour(email) {
        const res = await this.pool.query(`SELECT COUNT(*) AS count
       FROM email_verifications
       WHERE email = $1
         AND sent_at > now() - INTERVAL '1 hour'`, [email.toPrimitive()]);
        return parseInt(res.rows[0].count, 10);
    }
    rowToEntity(row) {
        return EmailVerification.fromPrimitive({
            id: row.id,
            identityId: row.identity_id ?? undefined,
            email: row.email,
            otpHash: row.otp_hash,
            otpSalt: row.otp_salt,
            status: row.status,
            attempts: row.attempts,
            maxAttempts: row.max_attempts,
            expiresAt: row.expires_at,
            sentAt: row.sent_at,
            usedAt: row.used_at ?? undefined,
            blockedAt: row.blocked_at ?? undefined,
        });
    }
}
