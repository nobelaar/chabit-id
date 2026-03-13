import 'dotenv/config';
import { startServer } from './shared/presentation/http/server.js';
import { pgPool } from './shared/infrastructure/db/pgPool.js';
import { MigrationRunner } from './shared/infrastructure/db/MigrationRunner.js';
import { logger } from './shared/infrastructure/logger.js';
const PORT = parseInt(process.env.PORT ?? '3001', 10);
// ── Bootstrap ─────────────────────────────────────────────────────────
async function bootstrap() {
    const migrationRunner = new MigrationRunner(pgPool);
    await migrationRunner.run();
    const { server } = startServer(PORT);
    // ── Graceful Shutdown ────────────────────────────────────────────────
    let shutdownInProgress = false;
    async function shutdown(signal) {
        if (shutdownInProgress)
            return;
        shutdownInProgress = true;
        logger.info({ signal }, 'shutdown received');
        server.close(() => logger.info('HTTP server closed'));
        await pgPool.end();
        logger.info('PostgreSQL pool drained');
        logger.info('shutdown complete');
        process.exit(0);
    }
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}
bootstrap().catch((err) => {
    logger.error({ err }, 'bootstrap failed');
    process.exit(1);
});
