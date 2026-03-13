export class PostgresAccountQueryAdapter {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async getAccountsByIdentityRef(ref) {
        const { rows } = await this.pool.query(`SELECT id, type, status FROM accounts WHERE identity_id = $1 AND status = 'ACTIVE'`, [ref.toPrimitive()]);
        return rows.map(r => ({
            id: r['id'],
            type: r['type'],
            status: r['status'],
        }));
    }
}
