export class PostgresAccountEventRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async save(event) {
        await this.pool.query(`INSERT INTO account_events (account_id, type, performed_by, metadata) VALUES ($1, $2, $3, $4)`, [
            event.accountId.toPrimitive(),
            event.type,
            event.performedBy?.toPrimitive() ?? null,
            event.metadata ? JSON.stringify(event.metadata) : null,
        ]);
    }
}
