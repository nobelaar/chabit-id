import { Pool } from 'pg';
import { TransactionRunner } from '../../application/ports/TransactionRunner.port.js';

export class PostgresTransactionRunner implements TransactionRunner {
  constructor(private readonly pool: Pool) {}

  async run<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
}
