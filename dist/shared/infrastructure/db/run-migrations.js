import { pgPool } from './pgPool.js';
import { MigrationRunner } from './MigrationRunner.js';
import { logger } from '../logger.js';
async function main() {
    const runner = new MigrationRunner(pgPool);
    try {
        await runner.run();
        process.exit(0);
    }
    catch (error) {
        logger.error({ err: error }, 'run-migrations failed');
        process.exit(1);
    }
    finally {
        await pgPool.end();
    }
}
main();
