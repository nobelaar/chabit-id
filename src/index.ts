import 'dotenv/config';
import { startServer } from './shared/presentation/http/server.js';
import { pgPool } from './shared/infrastructure/db/pgPool.js';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const { server } = startServer(PORT);

// ── Graceful Shutdown ─────────────────────────────────────────────────
let shutdownInProgress = false;

async function shutdown(signal: string): Promise<void> {
  if (shutdownInProgress) return;
  shutdownInProgress = true;

  console.log(`\n[Shutdown] ${signal} received — shutting down gracefully…`);

  server.close(() => console.log('[Shutdown] HTTP server closed'));

  await pgPool.end();
  console.log('[Shutdown] PostgreSQL pool drained');

  console.log('[Shutdown] Complete');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
