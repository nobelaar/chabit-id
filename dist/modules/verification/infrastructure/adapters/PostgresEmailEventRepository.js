export class PostgresEmailEventRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async save(event) {
        await this.pool.query(`INSERT INTO email_events (email, type, metadata, verification_id)
       VALUES ($1, $2, $3, $4)`, [
            event.email,
            event.type,
            event.metadata ? JSON.stringify(event.metadata) : null,
            event.verificationId ?? null,
        ]);
    }
}
