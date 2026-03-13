import { pgPool } from './pgPool.js';
import { MigrationRunner } from './MigrationRunner.js';

async function main() {
  const runner = new MigrationRunner(pgPool);

  try {
    await runner.run();
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await pgPool.end();
  }
}

main();
