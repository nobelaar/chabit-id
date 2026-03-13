import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../logger.js';
export class MigrationRunner {
    pool;
    migrationsDir;
    constructor(pool) {
        this.pool = pool;
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        this.migrationsDir = path.join(__dirname, 'migrations');
    }
    async run() {
        const client = await this.pool.connect();
        try {
            logger.info('Starting database migrations');
            await client.query(`SET search_path TO public`);
            await this.ensureMigrationsTable(client);
            const appliedMigrations = await this.getAppliedMigrations(client);
            const allMigrations = await this.getAllMigrationFiles();
            const pendingMigrations = allMigrations
                .filter((file) => !appliedMigrations.includes(file))
                .sort();
            if (pendingMigrations.length === 0) {
                logger.info('Database is up to date — no pending migrations');
                return;
            }
            logger.info({ count: pendingMigrations.length }, 'Pending migrations found');
            await client.query('BEGIN');
            for (const file of pendingMigrations) {
                logger.info({ file }, 'Applying migration');
                await this.applyMigration(client, file);
            }
            await client.query('COMMIT');
            logger.info('All migrations applied successfully');
        }
        catch (error) {
            await client.query('ROLLBACK');
            logger.error({ err: error }, 'Migration failed — rolling back');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async ensureMigrationsTable(client) {
        await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    }
    async getAppliedMigrations(client) {
        const res = await client.query('SELECT name FROM _migrations');
        return res.rows.map((row) => row.name);
    }
    async getAllMigrationFiles() {
        try {
            const files = await fs.readdir(this.migrationsDir);
            return files.filter((f) => f.endsWith('.sql'));
        }
        catch (error) {
            logger.error({ dir: this.migrationsDir }, 'Error reading migrations directory');
            throw error;
        }
    }
    async applyMigration(client, fileName) {
        const filePath = path.join(this.migrationsDir, fileName);
        const sql = await fs.readFile(filePath, 'utf-8');
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [fileName]);
    }
}
