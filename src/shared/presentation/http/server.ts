import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { errorHandler } from './error-handler.js';
import { createCorsMiddleware } from './cors.middleware.js';
// Verification
import { createVerificationRoutes } from '../../../modules/verification/presentation/http/verification.routes.js';
import { RequestEmailVerificationUseCase } from '../../../modules/verification/application/use-cases/RequestEmailVerification.usecase.js';
import { VerifyEmailUseCase } from '../../../modules/verification/application/use-cases/VerifyEmail.usecase.js';
import { PostgresEmailVerificationRepository } from '../../../modules/verification/infrastructure/adapters/PostgresEmailVerificationRepository.js';
import { PostgresEmailEventRepository } from '../../../modules/verification/infrastructure/adapters/PostgresEmailEventRepository.js';
import { HmacOtpHasher } from '../../../modules/verification/infrastructure/adapters/HmacOtpHasher.js';
import { CryptoOtpGenerator } from '../../../modules/verification/infrastructure/adapters/CryptoOtpGenerator.js';
import { StubEmailSender } from '../../../modules/verification/infrastructure/adapters/StubEmailSender.js';
import { PostgresTransactionRunner } from '../../../modules/verification/infrastructure/adapters/PostgresTransactionRunner.js';
import { pgPool } from '../../infrastructure/db/pgPool.js';

export interface AppContext {
  app: Hono;
  server: ServerType;
}

export function createApp(): Hono {
  const app = new Hono();

  // ── Health check (public, before CORS) ────────────────────────────
  app.get('/health', (c) => c.json({ status: 'ok' }));

  // ── CORS ──────────────────────────────────────────────────────────
  app.use('*', createCorsMiddleware());

  // ── Infrastructure ────────────────────────────────────────────────
  const verificationRepo = new PostgresEmailVerificationRepository(pgPool);
  const eventRepo = new PostgresEmailEventRepository(pgPool);
  const hasher = new HmacOtpHasher();
  const generator = new CryptoOtpGenerator();
  const emailSender = new StubEmailSender();

  // ── Use cases ─────────────────────────────────────────────────────
  const requestVerification = new RequestEmailVerificationUseCase(
    verificationRepo,
    eventRepo,
    hasher,
    generator,
    emailSender,
  );

  const txRunner = new PostgresTransactionRunner(pgPool);

  const verifyEmail = new VerifyEmailUseCase(
    verificationRepo,
    eventRepo,
    hasher,
    txRunner,
  );

  // ── Routes ────────────────────────────────────────────────────────
  const verificationRoutes = createVerificationRoutes(requestVerification, verifyEmail);
  app.route('/verification', verificationRoutes);

  // ── Error handler (last) ──────────────────────────────────────────
  app.onError(errorHandler);

  return app;
}

export function startServer(port: number): AppContext {
  const app = createApp();

  console.log(`\n🚀 chabit-identity starting on http://localhost:${port}`);

  const server = serve({ fetch: app.fetch, port });

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                   AVAILABLE ENDPOINTS                    ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  GET    http://localhost:${port}/health                      ║`);
  console.log(`║  POST   http://localhost:${port}/verification/email           ║`);
  console.log(`║  POST   http://localhost:${port}/verification/email/verify    ║`);
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  return { app, server };
}
